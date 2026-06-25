# Paginas de aniversariantes

Site responsivo para criar uma pagina individual por aniversariante no mesmo dominio, com mural de mensagens e envio direto para WhatsApp.

## Links

- Pagina publica: `/aniversariantes/feminino/maria`
- Pagina publica: `/aniversariantes/masculino/joao`
- Admin: `/admin/`

## Firebase

O app ja esta preparado para Firebase Auth + Firestore.

1. Crie ou escolha um projeto no Firebase.
2. Crie um Web App no projeto.
3. Copie a configuracao do Web App para `firebase-config.js`.
4. Ative Authentication > Sign-in method > Email/Password.
5. Crie um usuario admin em Authentication > Users.
6. Copie o UID desse usuario.
7. No Firestore, crie `admins/{UID}` com campos simples como:

```json
{
  "email": "admin@seudominio.com",
  "nome": "Admin"
}
```

Depois o admin acessa:

```text
/admin/
```

## Publicar regras e hosting

Defina o projeto correto:

```bash
npx.cmd -y firebase-tools@latest use SEU_PROJECT_ID
```

Publique Firestore rules/indexes:

```bash
npx.cmd -y firebase-tools@latest deploy --only firestore
```

Publique o site:

```bash
npx.cmd -y firebase-tools@latest deploy --only hosting
```

## Fallback local

Enquanto `firebase-config.js` estiver vazio, a pagina publica usa os arquivos locais:

- `data/feminino/maria.js`
- `data/masculino/joao.js`

Depois que o Firebase estiver configurado, o admin cria/edita aniversariantes no Firestore pelo painel `/admin/`.
