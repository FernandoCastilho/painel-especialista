// Explicit asset bindings: do not derive cells from catalog order.
// Renaming a topic requires updating its entry here; unknown topics use the fallback.
export const SECTOR_IMAGES = {
  "base-florestal": {
    "src": "./sector-images/base-florestal.jpg",
    "topics": {
      "Florestas plantadas": 1,
      "Serrarias": 2,
      "Lâminas": 3,
      "Compensados": 4,
      "MDF e MDP": 5,
      "Móveis": 6
    }
  },
  "transporte-logistica": {
    "src": "./sector-images/transporte-logistica.jpg",
    "topics": {
      "Carga geral": 1,
      "Transporte de madeira": 2,
      "Transporte de grãos": 3,
      "Transporte refrigerado": 4,
      "Transporte de produtos perigosos": 5,
      "Armazenagem": 6,
      "Logística portuária": 7
    }
  },
  "papel-celulose": {
    "src": "./sector-images/papel-celulose.jpg",
    "topics": {
      "Celulose": 1,
      "Papel": 2,
      "Papelão ondulado": 3,
      "Caixas": 4,
      "Sacos industriais": 5,
      "Tubetes": 6
    }
  },
  "alimentos-agroindustria": {
    "src": "./sector-images/alimentos-agroindustria.jpg",
    "topics": {
      "Frigoríficos": 1,
      "Laticínios": 2,
      "Moinhos": 3,
      "Óleos vegetais": 4,
      "Alimentos processados": 5,
      "Bebidas": 6
    }
  },
  "metalmecanico": {
    "src": "./sector-images/metalmecanico.jpg",
    "topics": {
      "Fundição": 1,
      "Usinagem": 2,
      "Estruturas metálicas": 3,
      "Máquinas industriais": 4,
      "Máquinas agrícolas": 5,
      "Equipamentos": 6
    }
  },
  "automotivo": {
    "src": "./sector-images/automotivo.jpg",
    "topics": {
      "Componentes automotivos": 1,
      "Implementos rodoviários": 2,
      "Reposição de autopeças": 3,
      "Distribuidores de peças": 4
    }
  },
  "construcao": {
    "src": "./sector-images/construcao.jpg",
    "topics": {
      "Construção residencial": 1,
      "Galpões": 2,
      "Infraestrutura": 3,
      "Cimento": 4,
      "Cerâmica": 5,
      "Vidros": 6,
      "Esquadrias": 7
    }
  },
  "textil": {
    "src": "./sector-images/textil.jpg",
    "topics": {
      "Fiação": 1,
      "Tecelagem": 2,
      "Malharia": 3,
      "Tinturaria": 4,
      "Confecção": 5,
      "Tecidos técnicos": 6
    }
  },
  "quimicos": {
    "src": "./sector-images/quimicos.jpg",
    "topics": {
      "Resinas": 1,
      "Transformação plástica": 2,
      "Embalagens flexíveis": 3,
      "Tintas": 4,
      "Limpeza": 5,
      "Borracha": 6
    }
  },
  "atacado": {
    "src": "./sector-images/atacado.jpg",
    "topics": {
      "Distribuição de alimentos": 1,
      "Distribuição de medicamentos": 2,
      "Distribuição de materiais de construção": 3,
      "Distribuição de insumos industriais": 4,
      "Distribuição de equipamentos": 5,
      "Distribuição de válvulas para óleo e gás": 6
    }
  },
  "tic": {
    "src": "./sector-images/tic.jpg",
    "topics": {
      "Integração de TI e infraestrutura digital": 1,
      "Cibersegurança": 2,
      "Redes e conectividade": 3,
      "Serviços gerenciados de TI": 4,
      "Comunicação e colaboração": 5,
      "Software e serviços de TI": 6,
      "Data centers e nuvem": 7,
      "Operadoras de telecomunicações": 8
    }
  },
  "turismo": {
    "src": "./sector-images/turismo.jpg",
    "topics": {
      "Hotelaria": 1,
      "Agências e operadoras": 2,
      "Receptivo e experiências": 3,
      "Eventos e turismo corporativo": 4
    }
  },
  "varejo": {
    "src": "./sector-images/varejo.jpg",
    "topics": {
      "Alimentos": 1,
      "Bebidas": 2,
      "Vestuário": 3
    }
  },
  "saude": {
    "src": "./sector-images/saude.jpg",
    "topics": {
      "Hospitais e clínicas": 1,
      "Diagnósticos": 2,
      "Produtos e equipamentos": 3
    }
  },
  "pet": {
    "src": "./sector-images/pet.jpg",
    "topics": {
      "Alimentação pet": 1,
      "Produtos e varejo pet": 2,
      "Serviços veterinários": 3
    }
  }
}

export function getSectorImage(groupId, topic) {
  const asset = SECTOR_IMAGES[groupId]
  const cell = topic === undefined ? 0 : asset?.topics[topic]
  return asset && Number.isInteger(cell) ? { src: asset.src, cell } : null
}
