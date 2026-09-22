# Archivo de productos

Colocá acá la lista de distribuidor de Ashir y ejecutá:

```bash
npm run import:products
```

El importador acepta `ashir-productos.xlsx` (nombre preferido) o el primer
`.xlsx`, `.xls`, `.xlsm` o `.csv` del directorio. **No modifica el archivo
original.**

Los archivos de planilla están excluidos del repositorio a propósito: la lista
de distribuidor incluye una hoja con datos bancarios de Ashir (CBU, alias,
CUIT) que no corresponde publicar. El catálogo ya procesado —sin esa hoja— está
commiteado en `apps/web/src/mocks/generated/`, así que la aplicación funciona
sin necesidad del Excel.
