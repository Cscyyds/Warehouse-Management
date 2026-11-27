import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import ts from 'typescript'
import { ref } from 'vue'
import { mergeGenerateError, mergeGeneratePayload, mergeProductLengthUnit, generatedQuantityTotal, runMergeGenerationBatch } from './mergePackageGenerate.ts'

test('只有已设置辅助长度单位的产品可填写长度，中文和大小写归一', () => {
  for (const [aliases, unit] of [ [['米','公尺','m','M'],'m'], [['分米','DM','dM','dm'],'dm'], [['厘米','公分','CM','cM','cm'],'cm'], [['毫米','公厘','MM','mM','mm'],'mm'] ]) {
    for (const name of aliases) assert.equal(mergeProductLengthUnit({assist_unit_id:'unit-1',assist_unit_name:` ${name} `}),unit)
  }
  for (const product of [{},{assist_unit_id:'unit-1'},{assist_unit_name:'M'},{assist_unit_id:'unit-1',assist_unit_name:'件'}]) assert.equal(mergeProductLengthUnit(product),undefined)
})

const draft = () => ({ productId: 'prd-test', quantity: '1.1250', count: '3', specifyLength: true, length: '1.500001', lengthUnit: 'm' })
test('生成数量精确、件数与打印份数分离，未指定长度时省略', () => {
  assert.deepEqual(mergeGeneratePayload(draft()), { product_id: 'prd-test', merge_qty: '1.1250', package_count: '3', merge_length: '1.500001m' })
  assert.equal(generatedQuantityTotal('1.1250','3'),'3.375')
  assert.equal(generatedQuantityTotal('0.0001','3'),'0.0003')
  assert.equal(Object.hasOwn(mergeGeneratePayload({ ...draft(), specifyLength: false }), 'merge_length'), false)
  for (const change of [{quantity:'0'},{quantity:'NaN'},{quantity:'1.12345'},{count:'0'},{count:'1.5'},{length:'1.1234567'},{productId:''}]) assert.ok(mergeGenerateError({...draft(),...change}))
})

function functions(file, names, imports, prefix='') {
  const { descriptor } = parse(readFileSync(new URL(file,import.meta.url),'utf8'))
  const source=ts.createSourceFile(file,descriptor.scriptSetup.content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
  const nodes=source.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text))
  const code=ts.transpileModule(nodes.map(node=>node.getText(source)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  return new Function(...Object.keys(imports),`${prefix};${code};return {${names.join(',')}}`)(...Object.values(imports))
}

const job = (key) => ({ key, productCode:key, productName:key, sourceBarcode:key, draft:draft(), status:'pending', generated:[], error:'' })
test('批量生成防重复提交，使用勾选快照，不重发成功项', async () => {
  let resolve
  let calls=0
  const state={saving:ref(false),lengthLoading:ref(false),lengthError:ref(''),jobs:ref([job('a')]),error:ref(''),disposed:false,session:()=> 'same',sessionAtOpen:'same',mergeGenerateError,runMergeGenerationBatch,
    generateMergePackages:()=>{calls++;return new Promise(r=>{resolve=r})},ElMessage:{success:()=>{}},emit:()=>{}}
  const {generate}=functions('../views/warehouse/components/MergePackageGenerateDialog.vue',['generate'],state)
  state.lengthLoading.value=true;await generate();assert.equal(calls,0)
  state.lengthLoading.value=false;state.lengthError.value='读取失败';await generate();assert.equal(calls,0)
  state.lengthError.value=''
  const first=generate();await generate();assert.equal(calls,1)
  resolve({new_merge_packages:[{merge_package_id:'mpb-1',barcode_code:'MPB001'}]});await first
  await generate();assert.equal(calls,1);assert.equal(state.jobs.value[0].generated[0].barcode_code,'MPB001')
})

test('请求必须串行，每次结束后间隔300ms，所有参数预先固定', async () => {
  const jobs=[job('a'),job('b')]
  const events=[]
  let active=0
  await runMergeGenerationBatch(jobs,async payload=>{
    assert.equal(active,0);active++
    events.push(['send',payload.merge_qty])
    jobs[1].draft.quantity='9'
    await Promise.resolve();active--;events.push(['done'])
    return {new_merge_packages:[]}
  },{wait:async ms=>{assert.equal(active,0);events.push(['wait',ms])}})
  assert.deepEqual(events,[['send','1.1250'],['done'],['wait',300],['send','1.1250'],['done']])
})

test('明确失败继续后续项，重试仅发送被明确选中的失败项', async () => {
  const jobs=[job('a'),job('b')];let count=0
  await runMergeGenerationBatch(jobs,async()=>{if(++count===1)throw {message:'产品不可用',response:{status:400}};return {new_merge_packages:[{barcode_code:'MPB2'}]}},{wait:async()=>{}})
  assert.deepEqual(jobs.map(r=>r.status),['failed','success'])
  jobs[0].status='pending'
  await runMergeGenerationBatch(jobs,async()=>{count++;return {new_merge_packages:[]}},{wait:async()=>{}})
  assert.equal(count,3)
  assert.equal(jobs[1].generated[0].barcode_code,'MPB2')
})

test('结果未确认或权限失败即暂停后续请求，不自动重试', async () => {
  for(const failure of [new Error('timeout'),{message:'权限不足',response:{status:403}}]) {
    const jobs=[job('a'),job('b')];let calls=0
    const reason=await runMergeGenerationBatch(jobs,async()=>{calls++;throw failure},{wait:async()=>{}})
    assert.ok(reason);assert.equal(calls,1);assert.equal(jobs[1].status,'pending')
    assert.equal(jobs[0].status,failure.response?'failed':'unknown')
  }
})

test('参数非法时整批不发送；会话变化后不发送下一项', async () => {
  const invalid=[job('a'),job('b')];invalid[1].draft.count='0';let calls=0
  await assert.rejects(runMergeGenerationBatch(invalid,async()=>{calls++;return {new_merge_packages:[]}}))
  assert.equal(calls,0)
  const jobs=[job('a'),job('b')];let active=true
  await runMergeGenerationBatch(jobs,async()=>{calls++;return {new_merge_packages:[]}},{wait:async()=>{active=false},isActive:()=>active})
  assert.equal(calls,1);assert.equal(jobs[1].status,'pending')
})

test('生成窗口关闭后才打开打印窗口，不叠弹窗', () => {
  const state={printRows:ref([]),printOpen:ref(false)}
  const handlers=functions('../views/warehouse/WarehouseMergePackage.vue',['queueGeneratedPrint','openGeneratedPrint'],state,'let pendingGeneratedPrint=null')
  handlers.queueGeneratedPrint([{id:'mpb-1',title:'产品',subtitle:'MPB001'}])
  assert.equal(state.printOpen.value,false)
  handlers.openGeneratedPrint();assert.equal(state.printOpen.value,true)
  assert.equal(state.printRows.value[0].id,'mpb-1')
  handlers.queueGeneratedPrint([{id:'mpb-2'},{id:'mpb-3'}])
  handlers.openGeneratedPrint()
  assert.deepEqual(state.printRows.value.map(row=>row.id),['mpb-2','mpb-3'])
})

test('生成结果打印提交全部成功条码，关闭生成窗口后由打印组件按数量分流', () => {
  for (const count of [1,3]) {
    const events=[]
    const state={saving:ref(false),open:ref(true),generated:ref(Array.from({length:count},(_,i)=>({merge_package_id:`mpb-${i}`,barcode_code:`MPB${i}`,productName:'产品'}))),emit:(...args)=>events.push(args)}
    const {print}=functions('../views/warehouse/components/MergePackageGenerateDialog.vue',['print'],state)
    print()
    assert.equal(state.open.value,false)
    assert.equal(events[0][0],'print')
    assert.equal(events[0][1].length,count)
  }
})

test('已有打印链路为预览与打印均传info_switch，false不能被省略', async () => {
  const sent=[]
  const state={props:{kind:'mergePackage'},modelCode:ref('model'),specId:ref('spec'),printModeHardware:ref('热敏'),labelType:ref('间隙纸'),printQty:ref(2),density:ref(3),infoSwitch:ref(false),printMergePackage:async(id,params)=>{sent.push({id,...params})}}
  const {callPrintApi}=functions('../components/PrintLabelDialog.vue',['callPrintApi'],state)
  await callPrintApi('PREVIEW',{id:'mpb-1'});await callPrintApi('PRINT',{id:'mpb-1'})
  assert.deepEqual(sent.map(r=>[r.print_mode,r.info_switch,r.print_qty]),[['PREVIEW',false,2],['PRINT',false,2]])
  state.infoSwitch.value=true;await callPrintApi('PREVIEW',{id:'mpb-1'});assert.equal(sent.at(-1).info_switch,true)
})

test('新增生成组件和合包页面模板编译通过', () => {
  for(const file of ['../views/warehouse/components/MergePackageGenerateDialog.vue','../views/warehouse/WarehouseMergePackage.vue']) {
    const {descriptor,errors}=parse(readFileSync(new URL(file,import.meta.url),'utf8'),{filename:file})
    assert.deepEqual(errors,[])
    const script=compileScript(descriptor,{id:file})
    assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:file,id:file,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  }
})

test('实际API封装：生成只提交建码字段，打印保留false及预览/打印枚举', async () => {
  const calls=[]
  function api(file) {
    const http={interceptors:{request:{use(){}},response:{use(){}}},post:async(url,body,config)=>{
      calls.push({url,body,config})
      return {success:true,data:{new_merge_packages:[{merge_package_id:'mpb-1',barcode_code:'MPB001',merge_qty:1.125}]}}
    }}
    const source=readFileSync(new URL(file,import.meta.url),'utf8')
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
    const module={exports:{}}
    new Function('require','module','exports',code)(id=>id==='axios'?{default:{create:()=>http}}:id.includes('scannerPrint')?{SCANNER_API_BASE_URL:'/scanner-api'}:{showErrorDialog(){}},module,module.exports)
    return module.exports
  }
  const generated=api('../api/modules/scannerMergePackage.ts')
  await generated.generateMergePackages(mergeGeneratePayload(draft()))
  const first=calls.at(-1)
  assert.equal(first.url,'/api/v1/tenant-wms/merge-packages/generate-from-product')
  assert.equal(first.body.get('merge_qty'),'1.1250')
  assert.equal(first.body.get('package_count'),'3')
  assert.equal(first.body.get('merge_length'),'1.500001m')
  assert.equal(first.body.has('info_switch'),false)
  assert.equal(first.body.has('print_mode'),false)
  assert.equal(first.body.has('request_id'),false)
  // scannerPrint的import.meta仅用于配置，按测试环境替换，不改变实际请求函数。
  const printerSource=readFileSync(new URL('../api/modules/scannerPrint.ts',import.meta.url),'utf8')
  const replaced=printerSource.replace(/import\.meta\.env\.VITE_SCANNER_API_BASE_URL/g,"'/scanner-api'")
  const http={interceptors:{request:{use(){}},response:{use(){}}},post:async(url,body)=>{calls.push({url,body});return {data:{}}}}
  const module={exports:{}}
  new Function('require','module','exports',ts.transpileModule(replaced,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='axios'?{default:{create:()=>http}}:{showErrorDialog(){}},module,module.exports)
  for(const mode of ['PREVIEW','PRINT']) {
    await module.exports.printMergePackage('mpb-1',{printer_model_code:'model',label_spec_id:'spec',print_mode:mode,print_mode_hardware:'热敏',label_type:'间隙纸',print_qty:2,info_switch:false})
    assert.equal(calls.at(-1).url,'/api/v1/tenant-wms/merge-packages/print')
    assert.equal(calls.at(-1).body.get('info_switch'),'false')
    assert.equal(calls.at(-1).body.get('print_mode'),mode)
  }
})
