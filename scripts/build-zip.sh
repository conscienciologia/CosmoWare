#!/usr/bin/env bash
set -euo pipefail

# Requisitos: jq, zip
command -v jq >/dev/null || { echo "jq não encontrado. Instale e rode novamente."; exit 1; }
command -v zip >/dev/null || { echo "zip não encontrado. Instale e rode novamente."; exit 1; }

# Lê versão do manifest.json
VERSION="$(jq -r '.version' manifest.json)"
if [[ -z "${VERSION}" || "${VERSION}" == "null" ]]; then
  echo "Não foi possível ler .version do manifest.json"
  exit 1
fi

NAME="cosmoware-extension-v${VERSION}"
OUT_DIR="dist"
OUT_ZIP="${OUT_DIR}/${NAME}.zip"
OUT_SHA="${OUT_ZIP}.sha256"

# Limpa e recria dist/
rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}/pkg"

# Lista de inclusões (ajuste se necessário)
INCLUDE=(
  "manifest.json"
  "core"
  "domains"
  "templates"
  "icons"
  # "README.md"   # descomente se quiser incluir
  # "LICENSE"     # descomente se quiser incluir
)

# Verificações mínimas
[[ -f manifest.json ]] || { echo "manifest.json ausente"; exit 1; }
[[ -d core ]] || { echo "core/ ausente"; exit 1; }
[[ -d domains ]] || { echo "domains/ ausente"; exit 1; }

# Copia
for p in "${INCLUDE[@]}"; do
  if [ -e "$p" ]; then
    cp -R "$p" "${OUT_DIR}/pkg/"
  fi
done

# Remoções defensivas (dentro do pacote)
find "${OUT_DIR}/pkg" -name "*.map" -delete || true
find "${OUT_DIR}/pkg" -name ".DS_Store" -delete || true
find "${OUT_DIR}/pkg" -name "node_modules" -type d -prune -exec rm -rf {} + || true
find "${OUT_DIR}/pkg" -name ".git" -type d -prune -exec rm -rf {} + || true
find "${OUT_DIR}/pkg" -name "tests" -type d -prune -exec rm -rf {} + || true

# Compacta
( cd "${OUT_DIR}/pkg" && zip -r "../${NAME}.zip" . )

# Checksum
( cd "${OUT_DIR}" && sha256sum "${NAME}.zip" | awk '{print $1}' > "${NAME}.zip.sha256" )

echo "OK: ${OUT_ZIP}"
echo "SHA256: $(cat "${OUT_SHA}")"
