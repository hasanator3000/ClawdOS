import type { PoolClient } from 'pg'

export interface Folder {
  id: string
  workspaceId: string
  parentId: string | null
  name: string
  createdAt: Date
  createdBy: string | null
}

export interface File {
  id: string
  workspaceId: string
  folderId: string | null
  name: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  checksum: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
}

export interface CreateFolderParams {
  workspaceId: string
  parentId?: string
  name: string
}

export interface CreateFileParams {
  workspaceId: string
  folderId?: string
  name: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  checksum?: string
  metadata?: Record<string, unknown>
}

// Folders

export async function createFolder(client: PoolClient, params: CreateFolderParams): Promise<Folder> {
  const { workspaceId, parentId, name } = params

  const result = await client.query(
    `insert into core.folder (workspace_id, parent_id, name, created_by)
     values ($1, $2, $3, core.current_user_id())
     returning
       id,
       workspace_id as "workspaceId",
       parent_id as "parentId",
       name,
       created_at as "createdAt",
       created_by as "createdBy"`,
    [workspaceId, parentId || null, name]
  )

  return result.rows[0] as Folder
}

export async function getFolderById(client: PoolClient, folderId: string): Promise<Folder | null> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       parent_id as "parentId",
       name,
       created_at as "createdAt",
       created_by as "createdBy"
     from core.folder
     where id = $1`,
    [folderId]
  )

  return (result.rows[0] as Folder) || null
}

export async function getFolderContents(
  client: PoolClient,
  workspaceId: string,
  parentId: string | null
): Promise<{ folders: Folder[]; files: File[] }> {
  const foldersResult = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       parent_id as "parentId",
       name,
       created_at as "createdAt",
       created_by as "createdBy"
     from core.folder
     where workspace_id = $1 and ${parentId ? 'parent_id = $2' : 'parent_id is null'}
     order by name asc`,
    parentId ? [workspaceId, parentId] : [workspaceId]
  )

  const filesResult = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       folder_id as "folderId",
       name,
       mime_type as "mimeType",
       size_bytes as "sizeBytes",
       storage_path as "storagePath",
       checksum,
       metadata,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"
     from core.file
     where workspace_id = $1 and ${parentId ? 'folder_id = $2' : 'folder_id is null'}
     order by name asc`,
    parentId ? [workspaceId, parentId] : [workspaceId]
  )

  return {
    folders: foldersResult.rows as Folder[],
    files: filesResult.rows as File[],
  }
}

export async function deleteFolder(client: PoolClient, folderId: string): Promise<boolean> {
  const result = await client.query('delete from core.folder where id = $1', [folderId])
  return (result.rowCount ?? 0) > 0
}

export async function renameFolder(
  client: PoolClient,
  folderId: string,
  newName: string
): Promise<Folder | null> {
  const result = await client.query(
    `update core.folder set name = $2 where id = $1
     returning
       id,
       workspace_id as "workspaceId",
       parent_id as "parentId",
       name,
       created_at as "createdAt",
       created_by as "createdBy"`,
    [folderId, newName]
  )

  return (result.rows[0] as Folder) || null
}

// Files

export async function createFile(client: PoolClient, params: CreateFileParams): Promise<File> {
  const { workspaceId, folderId, name, mimeType, sizeBytes, storagePath, checksum, metadata } = params

  const result = await client.query(
    `insert into core.file (workspace_id, folder_id, name, mime_type, size_bytes, storage_path, checksum, metadata, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, core.current_user_id())
     returning
       id,
       workspace_id as "workspaceId",
       folder_id as "folderId",
       name,
       mime_type as "mimeType",
       size_bytes as "sizeBytes",
       storage_path as "storagePath",
       checksum,
       metadata,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"`,
    [
      workspaceId,
      folderId || null,
      name,
      mimeType,
      sizeBytes,
      storagePath,
      checksum || null,
      JSON.stringify(metadata || {}),
    ]
  )

  return result.rows[0] as File
}

export async function getFileById(client: PoolClient, fileId: string): Promise<File | null> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       folder_id as "folderId",
       name,
       mime_type as "mimeType",
       size_bytes as "sizeBytes",
       storage_path as "storagePath",
       checksum,
       metadata,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"
     from core.file
     where id = $1`,
    [fileId]
  )

  return (result.rows[0] as File) || null
}

export async function deleteFile(client: PoolClient, fileId: string): Promise<File | null> {
  const result = await client.query(
    `delete from core.file where id = $1
     returning
       id,
       workspace_id as "workspaceId",
       folder_id as "folderId",
       name,
       mime_type as "mimeType",
       size_bytes as "sizeBytes",
       storage_path as "storagePath",
       checksum,
       metadata,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"`,
    [fileId]
  )

  return (result.rows[0] as File) || null
}

export async function renameFile(client: PoolClient, fileId: string, newName: string): Promise<File | null> {
  const result = await client.query(
    `update core.file set name = $2, updated_at = now() where id = $1
     returning
       id,
       workspace_id as "workspaceId",
       folder_id as "folderId",
       name,
       mime_type as "mimeType",
       size_bytes as "sizeBytes",
       storage_path as "storagePath",
       checksum,
       metadata,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"`,
    [fileId, newName]
  )

  return (result.rows[0] as File) || null
}

export async function moveFile(
  client: PoolClient,
  fileId: string,
  newFolderId: string | null
): Promise<File | null> {
  const result = await client.query(
    `update core.file set folder_id = $2, updated_at = now() where id = $1
     returning
       id,
       workspace_id as "workspaceId",
       folder_id as "folderId",
       name,
       mime_type as "mimeType",
       size_bytes as "sizeBytes",
       storage_path as "storagePath",
       checksum,
       metadata,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"`,
    [fileId, newFolderId]
  )

  return (result.rows[0] as File) || null
}

export async function getFilesByMimeType(
  client: PoolClient,
  workspaceId: string,
  mimeTypePrefix: string
): Promise<File[]> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       folder_id as "folderId",
       name,
       mime_type as "mimeType",
       size_bytes as "sizeBytes",
       storage_path as "storagePath",
       checksum,
       metadata,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"
     from core.file
     where workspace_id = $1 and mime_type like $2
     order by created_at desc`,
    [workspaceId, mimeTypePrefix + '%']
  )

  return result.rows as File[]
}
