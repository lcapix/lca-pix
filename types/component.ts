export interface ProcessNode {
  id: string
  name: string
  type: 'product' | 'machine' | 'subprocess' | 'operation' | 'elemental'
  description?: string
  parentId?: string
  children?: ProcessNode[]
}

export interface TreeNode extends ProcessNode {
  children: TreeNode[]
}