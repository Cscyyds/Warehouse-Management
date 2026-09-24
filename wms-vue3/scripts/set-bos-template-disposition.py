"""
给 BOS 上的导入模板对象补 `Content-Disposition`，让浏览器下载时使用中文文件名。

背景
----
模板迁到 BOS 后，前端 `<a download="客户导入模板.xlsx">` 在**跨域**时会被浏览器忽略
（HTML 规范：`download` 属性仅对同源 URL 生效），用户下载到的是英文 Key
（`customer-import-template.xlsx`）。唯一可行的补救是让**服务端**给出文件名，
即对象上的 `Content-Disposition` 响应头。

为什么需要这个脚本
------------------
在 BOS 控制台重新上传同名文件会**覆盖对象、丢掉自定义响应头**，文件名会悄悄退回英文。
以后更新模板后，跑一次本脚本即可补齐。

⚠️ 坑：BOS 会对写入的 header 值做**一次 URL 解码**再存储。
   实测提交 `%E5%AE%A2` 落库后变成原始 UTF-8 字节，浏览器会直接丢弃非 ASCII 的响应头。
   因此这里**双重编码**，BOS 解码一次后正好得到合规的 ASCII percent-encoded 形式。

用法
----
    python scripts/set-bos-template-disposition.py              # 处理全部模板
    python scripts/set-bos-template-disposition.py product-import-template.xlsx

凭据读取顺序：环境变量 BAIDU_BOS_AK / BAIDU_BOS_SK / BAIDU_BOS_BUCKET / BAIDU_BOS_ENDPOINT
            → 后端 `nuomi_wms/.env` 中的同名配置。**不要**把 AK/SK 硬编码进本文件。
"""
from __future__ import annotations

import hashlib
import hmac
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

FRONTEND = Path(__file__).resolve().parents[1]
BACKEND_ENV = FRONTEND.parents[1] / 'nuomi_wms' / '.env'

XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

# BOS Key -> 下载时展示的中文文件名
TEMPLATES = {
    'customer-import-template.xlsx': '客户导入模板.xlsx',
    'employee-import-template.xlsx': '员工导入模板.xlsx',
    'product-import-template.xlsx': '产品导入模板.xlsx',
    'purchase-order-import-template.xlsx': '采购订单导入模板.xlsx',
    'sales-order-import-template.xlsx': '销售订单导入模板.xlsx',
    'supplier-import-template.xlsx': '供应商导入模板.xlsx',
    'plastic-box-import-template.xlsx': '塑料盒导入模板.xlsx',
}


def load_config() -> tuple[str, str, str, str]:
    """读取 BOS 凭据：优先环境变量，其次后端 .env。"""
    values = {
        'BAIDU_BOS_AK': os.environ.get('BAIDU_BOS_AK', ''),
        'BAIDU_BOS_SK': os.environ.get('BAIDU_BOS_SK', ''),
        'BAIDU_BOS_BUCKET': os.environ.get('BAIDU_BOS_BUCKET', ''),
        'BAIDU_BOS_ENDPOINT': os.environ.get('BAIDU_BOS_ENDPOINT', ''),
    }
    if not all(values.values()) and BACKEND_ENV.exists():
        for line in BACKEND_ENV.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key, value = key.strip(), value.strip().strip('"\'')
            if key in values and not values[key]:
                values[key] = value
    missing = [k for k, v in values.items() if not v]
    if missing:
        raise SystemExit(f'缺少 BOS 配置：{", ".join(missing)}（环境变量或 {BACKEND_ENV}）')
    return values['BAIDU_BOS_AK'], values['BAIDU_BOS_SK'], values['BAIDU_BOS_BUCKET'], values['BAIDU_BOS_ENDPOINT']


def api_endpoint(endpoint: str, bucket: str) -> str:
    """把 virtual-host 风格 endpoint 归一为 API 端点（去掉 bucket 前缀）。"""
    parsed = urlparse(endpoint)
    host = parsed.netloc or parsed.path
    if host.startswith(f'{bucket}.'):
        host = host[len(bucket) + 1:]
    return f'{parsed.scheme}://{host}'


def authorization(*, method: str, bucket: str, key: str, timestamp: str,
                  headers: dict[str, str], ak: str, sk: str) -> str:
    """按 BOS 签名规则（与 app/utils/baidu_bos.py 一致）生成 Authorization。"""
    canonical_uri = '/' + quote(bucket, safe='') + '/' + quote(key, safe='/~')
    signed_headers = ';'.join(sorted(k.lower() for k in headers))
    canonical_headers = '\n'.join(
        f'{k.lower()}:{quote(str(headers[k]).strip(), safe="")}'
        for k in sorted(headers, key=lambda x: x.lower())
    )
    canonical_request = f'{method}\n{canonical_uri}\n\n{canonical_headers}'
    prefix = f'bce-auth-v1/{ak}/{timestamp}/1800'
    signing_key = hmac.new(sk.encode(), prefix.encode(), hashlib.sha256).hexdigest()
    signature = hmac.new(signing_key.encode(), canonical_request.encode(), hashlib.sha256).hexdigest()
    return f'{prefix}/{signed_headers}/{signature}'


def content_disposition(cn_name: str, ascii_fallback: str) -> str:
    """生成 Content-Disposition（双重编码，理由见模块 docstring）。"""
    encoded = quote(quote(cn_name), safe='')
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


def main() -> int:
    targets = sys.argv[1:] or list(TEMPLATES)
    unknown = [k for k in targets if k not in TEMPLATES]
    if unknown:
        raise SystemExit(f'未知的模板文件名：{", ".join(unknown)}')

    ak, sk, bucket, endpoint = load_config()
    api_base = api_endpoint(endpoint, bucket)
    host = urlparse(api_base).netloc
    local_dir = FRONTEND / 'public' / 'templates'

    failures: list[str] = []
    for key in targets:
        local_file = local_dir / key
        if not local_file.exists():
            failures.append(key)
            print(f'FAIL {key:<34} 本地文件不存在：{local_file}', flush=True)
            continue
        content = local_file.read_bytes()
        timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        headers = {
            'host': host,
            'x-bce-date': timestamp,
            'content-type': XLSX_MIME,
            'content-length': str(len(content)),
            'content-disposition': content_disposition(TEMPLATES[key], key),
        }
        auth = authorization(method='PUT', bucket=bucket, key=key, timestamp=timestamp,
                             headers=headers, ak=ak, sk=sk)
        url = f'{api_base}/{quote(bucket, safe="")}/{quote(key, safe="/~")}'
        request = Request(url, data=content, method='PUT', headers={**headers, 'authorization': auth})
        try:
            with urlopen(request, timeout=30) as response:
                status = int(getattr(response, 'status', 0) or 0)
            if status >= 300:
                raise RuntimeError(f'HTTP {status}')
            print(f'OK   {key:<34} -> {TEMPLATES[key]}', flush=True)
        except Exception as exc:
            failures.append(key)
            print(f'FAIL {key:<34} {type(exc).__name__}: {exc}', flush=True)

    print(f'\n失败：{failures if failures else "无"}')
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
