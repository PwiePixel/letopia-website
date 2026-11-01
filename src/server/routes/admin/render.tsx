import type { Child } from "hono/jsx";
import type { Ctx } from "../../http.js";
import type { User } from "../../repo/users.js";
import { AdminLayout } from "../../views/admin/ui.js";
import { csrfToken } from "./auth.js";

/** Rendert eine Admin-Seite im gemeinsamen Layout. */
export const view = (c: Ctx, title: string, active: string, body: Child, status: 200 | 400 | 403 | 404 | 422 = 200) =>
  c.html(
    <AdminLayout title={title} user={c.get("user") as User} active={active} csrf={csrfToken(c)} flash={c.get("flash")}>
      {body}
    </AdminLayout>,
    status
  );

/** Nur Rücksprünge innerhalb des Admin-Panels zulassen. */
export const safeReturn = (value: string | undefined | null) => (value && /^\/admin(\/[\w\-/?=&%.#]*)?$/.test(value) ? value : "/admin");
