
export type UserRole = "pm" | "member" | "viewer" | "admin";

export interface UserProfile {
  role: UserRole;
  phone?: string;
  avatar_url?: string;
}

export interface AppUser {
  id: number;
  username: string;
  email: string;
  profile?: UserProfile;
}
