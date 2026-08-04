import { customerSemanticPages } from './customer.ts'
import { dashboardSemanticPages } from './dashboard.ts'
import { deliverySemanticPages } from './delivery.ts'
import { financeSemanticPages } from './finance.ts'
import { productSemanticPages } from './product.ts'
import { purchaseSemanticPages } from './purchase.ts'
import { salesSemanticPages } from './sales.ts'
import { systemSemanticPages } from './system.ts'
import { warehouseSemanticPages } from './warehouse.ts'
import type { AgentSemanticPageMap } from './types.ts'

export type {
  AgentSemanticCapability,
  AgentSemanticPageMap,
  AgentSemanticPageMetadata,
} from './types.ts'

export const agentSemanticPages: AgentSemanticPageMap = {
  ...dashboardSemanticPages,
  ...systemSemanticPages,
  ...customerSemanticPages,
  ...productSemanticPages,
  ...warehouseSemanticPages,
  ...purchaseSemanticPages,
  ...salesSemanticPages,
  ...deliverySemanticPages,
  ...financeSemanticPages,
}
