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

Se o painel mostrar `Sem permissao no Firestore`, copie o `UID logado` exibido na tela e confira dois pontos:

- Existe um documento `admins/{UID_LOGADO}` no Firestore.
- As regras foram publicadas com `npx.cmd -y firebase-tools@latest deploy --only firestore`.

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

## Musica e playlist

No admin, preencha `Links MP3 ou YouTube` com um link por linha e, se quiser, `Titulos das musicas` com um titulo por linha. Links diretos de audio como `.mp3`, `.wav` e `.ogg` tocam no mini system da pagina. Links do YouTube abrem em player incorporado; eles nao viram MP3 automaticamente.

As mensagens prontas `Mensagem 1`, `Mensagem 2` e `Mensagem 3` aceitam ate 700 caracteres cada.

Nos arquivos locais, use:

```js
musica: {
  titulo: "Primeira musica\nSegunda musica",
  url: "assets/musica-1.mp3\nhttps://exemplo.com/musica-2.mp3"
}
```
