import { tool } from 'page-agent'
import { z } from 'zod'
import { verifyTaskCompletion } from './taskExecutionLedger'

export const verifiedDoneTool = tool({
  description:
    'Complete the task. A success result is accepted only when WMS execution evidence matches the task contract.',
  inputSchema: z.object({
    text: z.string(),
    success: z.boolean().default(true),
  }),
  execute: async function (input) {
    const verified = verifyTaskCompletion(this.taskId, input)
    input.success = verified.success
    input.text = verified.text
    return verified.success ? 'Task completed with verified WMS evidence' : 'Task incomplete'
  },
})
