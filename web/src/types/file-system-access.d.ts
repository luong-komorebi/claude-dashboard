// TypeScript 6 DOM lib doesn't yet include the full File System Access API surface
// or the View Transitions API. These augmentations cover what we use.

interface FileSystemHandle {
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface SaveFilePickerAcceptType {
  description?: string
  accept: Record<string, string | string[]>
}

interface OpenFilePickerAcceptType {
  description?: string
  accept: Record<string, string | string[]>
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string
    mode?: 'read' | 'readwrite'
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle
  }): Promise<FileSystemDirectoryHandle>

  showSaveFilePicker(options?: {
    suggestedName?: string
    types?: SaveFilePickerAcceptType[]
    excludeAcceptAllOption?: boolean
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle
  }): Promise<FileSystemFileHandle>

  showOpenFilePicker(options?: {
    id?: string
    multiple?: boolean
    excludeAcceptAllOption?: boolean
    types?: OpenFilePickerAcceptType[]
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle
  }): Promise<FileSystemFileHandle[]>
}

// Badging API — lets installed PWAs show a count badge on their app icon.
interface Navigator {
  setAppBadge?(count?: number): Promise<void>
  clearAppBadge?(): Promise<void>
}

// View Transitions API
interface ViewTransition {
  readonly finished: Promise<void>
  readonly ready: Promise<void>
  readonly updateCallbackDone: Promise<void>
  skipTransition(): void
}

interface Document {
  startViewTransition(updateCallback?: () => void | Promise<void>): ViewTransition
}
