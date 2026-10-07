export interface Cipher { iv: string; ct: string }
export interface Entry {
  id: string; name: string; url: string; username: string; password: string; notes: string;
  updated: number; deleted?: boolean; // soft-delete so deletions sync across devices
}
export interface Pending { url: string; username: string; password: string }
