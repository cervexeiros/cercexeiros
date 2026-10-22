# Cervexeiros Caseiros Pontevedra

Web da Asociación de Cervexeiros Caseiros de Pontevedra (ACCP), publicada con GitHub Pages.

## Escribir no blog

Entra en `/admin/` da web (por exemplo https://cervexeiros.github.io/cercexeiros/admin/) coa túa chave de acceso de GitHub.
Desde aí creas, editas e eliminas entradas. Ao gardar, a web actualízase soa en 1 ou 2 minutos.

## Como está feita

- `_blog/*.json`: as entradas do blog (texto, portada, slug, autor, data, SEO).
- `_xerador/xerador.js`: plantillas que xeran as páxinas (úsanse no navegador e en Node).
- `_xerador/paxinas/`: contido das páxinas fixas (Inicio, Quen somos, Faite socio/a, Contacto).
- `_datos/config.json`: nome, URL da web, correo, autores. **Se cambia o dominio, cambia aquí `url` e rexenera.**
- `admin/`: área privada.
- Para rexenerar toda a web: `node _xerador/build.mjs`.
