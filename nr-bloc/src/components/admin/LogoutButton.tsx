import { logout } from "@/app/admin/actions";

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm text-foreground/60 transition-colors hover:text-pink"
      >
        Log Out
      </button>
    </form>
  );
}
