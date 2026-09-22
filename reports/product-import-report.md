# Reporte de importación de productos

- **Archivo origen:** `ashir-productos.xlsx`
- **Hoja utilizada:** `Lista Ashir` (encabezados detectados en la fila 5)
- **Fecha de importación:** 2026-09-22T15:58:38.547Z
- **Filas válidas:** 245
- **Filas ignoradas:** 13 (títulos de sección, filas vacías, duplicados o sin precio)
- **Marcas:** 10
- **Categorías:** 11
- **Observaciones:** 38

## Mapeo aplicado

| Campo del sistema | Columna del Excel | Origen |
|---|---|---|
| `sku` | COD. INTERNO | real |
| `partNumber` | PART NUMBER | real |
| `name` | DESCRIPCIÓN (sin marcadores promocionales) | real |
| `brand` | derivada del prefijo de DESCRIPCIÓN | derivada |
| `category` | fila de sección del listado | derivada |
| `listPrice` | DISTRI S/IVA (USD) | real |
| `suggestedRetail` | FINAL | real |
| `vatRate` | IVA | real |
| `availability` | ESTADO | real |
| `specs` / `description` | DETALLES | real |
| `cost`, `marginPct` | — | **simulado (demo)** |
| `stock`, `incoming` | derivado cualitativamente de ESTADO | **cantidad simulada (demo)** |
| `unitsSold12m`, `createdAt` | — | **simulado (demo)** |
| `image` | no existe en el archivo | sin dato — la UI usa un tile de marca |

> El Excel no contiene costos ni cantidades de stock. `cost` y `stock` se generan con un
> PRNG determinista sembrado con el SKU (estables entre corridas) y quedan marcados como
> simulados. El portal no los presenta nunca como información productiva.

## Distribución por estado

- `IN_STOCK`: 176
- `OUT_OF_STOCK`: 34
- `INCOMING`: 5
- `NEW_ARRIVAL`: 30

## Marcas detectadas

| Marca | SKUs | Categorías |
|---|---:|---|
| THERMALTAKE | 61 | Fuentes, Gabinetes, Refrigeración |
| ASUS | 45 | Fuentes, Refrigeración, Motherboards, GPUs, Monitores |
| MSI | 43 | Fuentes, Gabinetes, Refrigeración, Motherboards, GPUs, Monitores, Periféricos |
| EVOLABS | 34 | Fuentes, Gabinetes, Refrigeración, Sillas gamer |
| ADATA | 29 | Memorias, SSD |
| AUREOX | 15 | Fuentes, Periféricos |
| AMD | 12 | Procesadores |
| WICGTYP | 2 | Memorias |
| ACER | 2 | Memorias |
| TTESPORTS | 2 | Periféricos |

## Categorías detectadas

| Categoría | Grupo | SKUs |
|---|---|---:|
| Refrigeración | Componentes | 40 |
| Gabinetes | Componentes | 38 |
| Motherboards | Componentes | 34 |
| Fuentes | Componentes | 28 |
| Memorias | Componentes | 25 |
| GPUs | Componentes | 22 |
| Periféricos | Periféricos | 16 |
| Monitores | Visualización | 15 |
| Procesadores | Componentes | 12 |
| SSD | Almacenamiento | 8 |
| Sillas gamer | Mobiliario | 7 |

## Secciones leídas del archivo

- FUENTES DE ALIMENTACIÓN (PSU)
- GABINETES
- MICROPROCESADORES (CPU)
- REFRIGERACIÓN (CPU COOLERS / WATERCOOLERS / FANS)
- MOTHERBOARDS
- PLACAS DE VIDEO (VGA)
- MEMORIA RAM DDR4
- MEMORIA RAM DDR5
- DISCOS DE ESTADO SÓLIDO (SSD / M.2)
- SILLAS GAMER / ESCRITORIOS
- MONITORES (IMPUESTOS INTERNOS INCLUÍDOS)
- PERIFÉRICOS GAMER

## Observaciones por fila

| Fila | SKU | Observación |
|---:|---|---|
| 20 | TTPS600D2DSM | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 23 | TTPS600SRGB | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 26 | TTPS650SBXRG | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 36 | ELGAEVO100A | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 42 | ELGAEVO300MB | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 44 | ELGAEVO305AB | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 61 | TTGAVI200TGS | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 66 | TTGAVI380TGB | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 68 | TTGAVI380XLB | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 76 | AMCPRY55GTTC | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 78 | AMCPRY57GTRC | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 79 | AMCPRY55X3DT | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 83 | AMCPRY8600GB | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 86 | AMCPRY99503T | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 95 | ELCCAIRCR3H | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 120 | TTCCA600ARGB | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 171 | ASVG5070PO12 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 172 | ASVG507TPO16 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 173 | ASVGT5080O16 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 175 | ASVG5090RALC | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 180 | MSVG5060S2O8 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 181 | MSVG506V3X8O | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 184 | MSVG5070S3XO | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 188 | ADRAS8GD4320 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 193 | ACRAD16D5480 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 196 | ADRAD16D5480 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 197 | ADRAS16GD548 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 207 | AXRALBR3260W | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 221 | ADSSML9702TB | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 231 | ASLMVG249QL3 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 232 | ASLMVG279Q3A | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 233 | ASLMVG27AQL3 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 234 | ASLMVG34VQL3 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 235 | MSLMM245FX24 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 236 | MSLMM255FX24 | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 248 | AUHEGH400STR | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 249 | AUHEGH600TRE | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
| 250 | AUMOGM200FIR | Sin precio publicado en el archivo (valor "-") - se importa como "consultar" |
