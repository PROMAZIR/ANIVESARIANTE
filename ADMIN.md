# Guia do admin

## Como acessar

Depois de publicado, abra:

```text
https://SEU_DOMINIO/admin/
```

No ambiente local com servidor:

```text
http://127.0.0.1:PORTA/admin/
```

Entre com o e-mail e senha cadastrados no Firebase Authentication.

## Como liberar um admin

1. Firebase Console > Authentication > Users.
2. Crie um usuario com e-mail e senha.
3. Copie o UID do usuario.
4. Firebase Console > Firestore Database.
5. Crie a collection `admins`.
6. Dentro dela, crie um documento com o ID igual ao UID.
7. Campos sugeridos:

```json
{
  "email": "admin@seudominio.com",
  "nome": "Admin"
}
```

Sem esse documento `admins/{UID}`, o usuario ate consegue autenticar, mas nao entra no painel.

## O que o painel faz

- Cria paginas de aniversariantes.
- Edita nome, slug, genero, WhatsApp, foto, textos e tema.
- Ativa ou desativa uma pagina.
- Mostra o link publico.
- Lista mensagens do mural.
- Apaga mensagens indesejadas.

## Estrutura no Firestore

```text
admins/{uid}
celebrants/{genero_slug}
celebrants/{genero_slug}/messages/{messageId}
```

Exemplo de ID de aniversariante:

```text
feminino_maria
masculino_joao
```

Os links publicos ficam:

```text
/aniversariantes/feminino/maria
/aniversariantes/masculino/joao
```

## Observacao

Se `firebase-config.js` estiver vazio, o admin mostra um aviso para preencher a configuracao do Firebase.
