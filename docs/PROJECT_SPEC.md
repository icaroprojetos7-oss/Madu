# Especificação oficial do projeto

## Produto
MADU ACESSÓRIOS é uma loja virtual premium, mobile-first, orientada para semijoias e acessórios com conversão por WhatsApp.

## Objetivo
- Apresentar catálogo visualmente refinado.
- Dar suporte ao carrinho e à revisão do pedido.
- Permitir edição de produtos, imagens e preços pelo painel administrativo.
- Finalizar a negociação diretamente pelo WhatsApp.

## Requisitos principais
- Interface premium em rosa pastel e visual delicado.
- Arquitetura React + TypeScript + Vite.
- Suporte mobile primeiro com layouts responsivos.
- Carrinho persistente no navegador.
- Pedidos registrados no banco antes de compartilhar pelo WhatsApp.
- Compartilhamento nativo das imagens originais quando suportado; fallback de texto com aviso explícito.
- Confirmação administrativa de venda, cancelamento e estorno com controle transacional de estoque.
- Dados configuráveis a partir do painel admin.

## Escopo inicial
- Loja pública com home, catálogo, detalhe, carrinho e finalização.
- Painel administrativo de visão geral e ações rápidas.
- Produtos mockados apenas para desenvolvimento sem Supabase.
- Catálogo, pedidos, snapshots e movimentações de estoque persistidos no Supabase.
- Sem pagamento online ou envio automático por WhatsApp Business Cloud API.
