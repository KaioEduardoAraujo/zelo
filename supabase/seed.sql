-- =============================================================================
-- Zelo · Seed: 5 templates globais (dono_id nulo), um por nicho.
-- Valores em centavos. valor_total_centavos = soma dos itens (conferido pelo teste
-- tests/db/templates.test.ts com o mesmo schema Zod da aplicação).
-- O admin NÃO é criado aqui (a senha não pode ficar em SQL): use `npm run db:seed-admin`.
-- =============================================================================

insert into public.templates (nicho, titulo, conteudo) values
(
  'reforma',
  'Reforma de banheiro',
  $json${
    "escopo": "Reforma completa do banheiro social: retirada do revestimento antigo, impermeabilização da área do box, assentamento de porcelanato no piso e nas paredes e reinstalação de louças e metais.",
    "itens": [
      { "descricao": "Demolição do revestimento e retirada do entulho até a caçamba", "unidade": "vb", "quantidade": 1, "valor_unitario_centavos": 120000 },
      { "descricao": "Impermeabilização da área do box com manta líquida", "unidade": "m²", "quantidade": 4, "valor_unitario_centavos": 9500 },
      { "descricao": "Assentamento de porcelanato no piso e nas paredes", "unidade": "m²", "quantidade": 22, "valor_unitario_centavos": 11000 },
      { "descricao": "Instalação de vaso, cuba, torneira e chuveiro", "unidade": "vb", "quantidade": 1, "valor_unitario_centavos": 65000 },
      { "descricao": "Rejunte, silicone e limpeza final", "unidade": "vb", "quantidade": 1, "valor_unitario_centavos": 48000 }
    ],
    "exclusoes": [
      "Compra de porcelanato, argamassa, louças e metais (fornecidos pelo cliente)",
      "Aluguel de caçamba para entulho",
      "Serviços de elétrica e hidráulica fora da área do banheiro",
      "Gesso, forro e pintura do teto"
    ],
    "valor_total_centavos": 513000,
    "prazo": "15 dias úteis a partir do início da obra",
    "pagamento": "40% na aprovação, 30% na metade da obra e 30% na entrega",
    "garantia": "12 meses sobre a mão de obra, contados da entrega",
    "validade_dias": 15
  }$json$::jsonb
),
(
  'assistencia_tecnica',
  'Troca de tela de smartphone',
  $json${
    "escopo": "Substituição da tela (display e touch) do aparelho iPhone 12 com trinca no vidro e manchas na imagem. Inclui testes de touch, Face ID, câmera frontal e brilho após a troca.",
    "itens": [
      { "descricao": "Tela compatível iPhone 12 (OLED)", "unidade": "un", "quantidade": 1, "valor_unitario_centavos": 78000 },
      { "descricao": "Mão de obra de substituição e testes", "unidade": "un", "quantidade": 1, "valor_unitario_centavos": 15000 },
      { "descricao": "Película de vidro 3D", "unidade": "un", "quantidade": 1, "valor_unitario_centavos": 4000 }
    ],
    "exclusoes": [
      "Backup e recuperação de dados",
      "Defeitos não relacionados à tela (placa, bateria, conector de carga)",
      "Danos por líquido identificados na abertura do aparelho"
    ],
    "valor_total_centavos": 97000,
    "prazo": "Até 2 dias úteis após a aprovação",
    "pagamento": "Pix ou cartão de crédito na retirada do aparelho",
    "garantia": "90 dias para peça e serviço, exceto queda, pressão ou contato com líquido",
    "validade_dias": 7
  }$json$::jsonb
),
(
  'design',
  'Identidade visual',
  $json${
    "escopo": "Criação da identidade visual da marca: pesquisa de referências, três propostas de logotipo, até duas rodadas de ajuste na proposta escolhida e manual de marca resumido com cores, tipografia e aplicações.",
    "itens": [
      { "descricao": "Briefing e pesquisa de referências", "unidade": "vb", "quantidade": 1, "valor_unitario_centavos": 60000 },
      { "descricao": "Criação de logotipo com 3 propostas e até 2 rodadas de ajuste", "unidade": "vb", "quantidade": 1, "valor_unitario_centavos": 180000 },
      { "descricao": "Manual de marca resumido e arquivos finais (SVG, PNG e PDF)", "unidade": "vb", "quantidade": 1, "valor_unitario_centavos": 90000 }
    ],
    "exclusoes": [
      "Registro da marca no INPI",
      "Impressão de materiais",
      "Rodadas de ajuste além das 2 incluídas (orçadas à parte)",
      "Criação de site e posts para redes sociais"
    ],
    "valor_total_centavos": 330000,
    "prazo": "20 dias corridos após a reunião de briefing",
    "pagamento": "50% na aprovação e 50% na entrega dos arquivos finais",
    "garantia": "Correção de arquivos com defeito técnico por 30 dias após a entrega",
    "validade_dias": 10
  }$json$::jsonb
),
(
  'agencia',
  'Gestão de redes sociais (mensal)',
  $json${
    "escopo": "Gestão mensal do Instagram e do Facebook da empresa: planejamento de conteúdo, criação de posts para o feed, gestão de anúncios e relatório de resultados no fim do mês.",
    "itens": [
      { "descricao": "Planejamento do calendário de conteúdo do mês", "unidade": "vb", "quantidade": 1, "valor_unitario_centavos": 50000 },
      { "descricao": "Criação de post para o feed (arte e legenda)", "unidade": "un", "quantidade": 12, "valor_unitario_centavos": 9000 },
      { "descricao": "Configuração e acompanhamento de anúncios", "unidade": "vb", "quantidade": 1, "valor_unitario_centavos": 70000 },
      { "descricao": "Relatório mensal de resultados", "unidade": "un", "quantidade": 1, "valor_unitario_centavos": 20000 }
    ],
    "exclusoes": [
      "Verba de anúncios (paga pelo cliente direto à plataforma)",
      "Produção de fotos e vídeos",
      "Atendimento de mensagens e comentários (SAC)"
    ],
    "valor_total_centavos": 248000,
    "prazo": "Contrato mensal, com início em até 7 dias após o aceite",
    "pagamento": "Mensal, por Pix ou boleto até o dia 10",
    "garantia": "Posts com erro de informação são corrigidos sem custo",
    "validade_dias": 10
  }$json$::jsonb
),
(
  'instalacao',
  'Instalação de ar-condicionado split',
  $json${
    "escopo": "Instalação de ar-condicionado split de até 12.000 BTUs em apartamento: fixação da evaporadora e da condensadora, passagem da tubulação, vácuo, carga de teste e ponto elétrico dedicado.",
    "itens": [
      { "descricao": "Instalação de split até 12.000 BTUs (com 3 m de tubulação)", "unidade": "un", "quantidade": 1, "valor_unitario_centavos": 65000 },
      { "descricao": "Tubulação de cobre adicional com isolamento", "unidade": "m", "quantidade": 3, "valor_unitario_centavos": 12000 },
      { "descricao": "Suporte para condensadora", "unidade": "un", "quantidade": 1, "valor_unitario_centavos": 15000 },
      { "descricao": "Ponto elétrico dedicado com disjuntor", "unidade": "un", "quantidade": 1, "valor_unitario_centavos": 28000 }
    ],
    "exclusoes": [
      "Aparelho de ar-condicionado",
      "Obras de alvenaria, gesso ou pintura",
      "Andaime ou equipamento para trabalho em altura acima do 2º andar"
    ],
    "valor_total_centavos": 144000,
    "prazo": "Execução em 1 dia, agendada em até 5 dias úteis após o aceite",
    "pagamento": "50% no agendamento e 50% na conclusão, por Pix",
    "garantia": "90 dias para a instalação (vazamentos e conexões)",
    "validade_dias": 7
  }$json$::jsonb
);
