export type AdminUser = {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  role_name: string | null;
  created_at: string;
};
