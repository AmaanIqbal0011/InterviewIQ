import { Suspense } from "react";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthService } from "@/services/AuthService";
import { Navbar, type NavItem, type NavbarUser } from "@/components/layout/Navbar";

interface SessionNavbarProps {
  links: readonly NavItem[];
}

/**
 * Landing navbar with the visitor's identity resolved on the server.
 *
 * The session read sits behind its own Suspense boundary so the rest of the
 * page still streams from the static shell. The fallback reserves the
 * navbar's height without any auth buttons, so signed-in visitors never see
 * "Log in" flash before their name appears.
 */
export function SessionNavbar({ links }: SessionNavbarProps) {
  return (
    <Suspense fallback={<NavbarPlaceholder />}>
      <NavbarWithSession links={links} />
    </Suspense>
  );
}

async function NavbarWithSession({ links }: SessionNavbarProps) {
  // Session reads are request-time only: supabase-js compares token expiry
  // against Date.now(), which is unstable while prerendering.
  await connection();

  const supabase = await createSupabaseServerClient();
  const result = await new AuthService(supabase).getCurrentUser();

  // A failed lookup (transient provider error) degrades to the signed-out
  // chrome instead of taking the public page down.
  const user: NavbarUser | null =
    result.ok && result.user !== null
      ? { name: result.user.displayName, email: result.user.email }
      : null;

  return <Navbar links={links} user={user} />;
}

/** Same footprint as Navbar, minus the content, so the swap shifts nothing. */
function NavbarPlaceholder() {
  return (
    <header
      className="sticky top-0 z-50 h-16 border-b border-transparent md:h-20"
      aria-hidden="true"
    />
  );
}
