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

# AGENTS

- .crm (AGS room) decoding happens fully client-side in src/lib/crm.ts — files never leave the user's browser and no backend is needed.
- Backgrounds are found by scanning room blocks 1 and 6 for validated LZSS headers — more robust across AGS room versions than parsing every field.
