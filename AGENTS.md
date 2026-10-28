<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the generated browser Supabase client for app authentication, profile reads and existing admin-users invocations; never import the privileged server client into application code.
- Keep the diary and team routes in the authenticated layout; the auth route is the only public sign-in surface, so private UI never renders before identity and active-profile verification.
- Centralize name-to-email conversion and visual permission checks in shared auth modules; existing Supabase rules remain the authoritative authorization layer.
- The diary remains a per-user browser-local draft until database-backed diary persistence is explicitly requested; do not imply it is synchronized to Supabase.
