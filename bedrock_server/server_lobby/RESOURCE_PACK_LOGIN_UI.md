# Resource Pack Login UI

Resource pack `Server_MC Login UI` dipasang untuk memberi teks/branding client-side pada overlay Login/Register.

## Files

- `resource_packs/servermc_login_ui/manifest.json`
- `resource_packs/servermc_login_ui/texts/en_US.lang`
- `resource_packs/servermc_login_ui/texts/id_ID.lang`
- `worlds/Maharlika_City/world_resource_packs.json`

## Behavior

- Resource pack aktif di world `Maharlika_City`.
- `server.properties` memakai `texturepack-required=true`, jadi client wajib menerima pack saat join.
- Behavior pack `Server_MC Login Overlay` membaca translation key dari resource pack untuk teks Login/Register.

## Limits

Bedrock tidak menyediakan cara sederhana untuk membuka layar HTML/CSS custom seperti website dari BDS vanilla.

Implementasi ini memakai:

- resource pack untuk teks/branding UI,
- behavior pack Script API untuk memunculkan form Login/Register.

Kalau ingin visual yang jauh lebih custom, langkah berikutnya adalah membuat override UI JSON atau memakai proxy/plugin yang lebih fleksibel. Ini perlu pengujian client-side karena UI JSON Bedrock sensitif versi.

## Rollback

Jika player gagal join karena resource pack, ubah:

```properties
texturepack-required=false
```

dan kosongkan:

```json
[]
```

di `worlds/Maharlika_City/world_resource_packs.json`.
