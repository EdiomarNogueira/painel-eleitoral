# Recriar o repositório sem o histórico anterior

Apagar o repositório no GitHub não apaga o histórico da sua pasta local. Um novo `git push` feito a partir da pasta antiga pode enviar novamente todos os commits e seus dados de autoria.

## Usando o pacote limpo

1. Extraia `painel-eleitoral.zip` em uma pasta nova, fora do repositório antigo.
2. O pacote não inclui `.git`, configurações privadas de hospedagem nem credenciais. Ele contém os fontes, os testes e os dados eleitorais públicos.
3. Crie o novo repositório no GitHub. Não copie a pasta `.git` antiga.
4. No terminal, dentro da pasta extraída, execute:

```powershell
git init -b main
git config --local user.name "Painel Eleitoral"
git config --local user.email "projeto@example.invalid"
git add .
git commit -m "Versão inicial do painel"
```

Essa identidade é genérica e não contém seu nome nem e-mail pessoal. O domínio `.invalid` não é um endereço de contato. Se quiser atribuir os commits à sua conta, substitua a identidade pelo nome desejado e pelo endereço noreply exibido nas configurações de e-mail do GitHub.

Depois, adicione o endereço do novo repositório como `origin` e envie a branch `main`. Não use os comandos de envio na pasta antiga.

## Publicar o site

Em `Settings > Pages > Build and deployment > Source`, selecione **GitHub Actions**. Os workflows existentes publicam a pasta `dist`. O site não depende do nome do usuário ou do repositório antigo.

A identidade da conta proprietária continua visível no GitHub e no endereço padrão do Pages. A limpeza dos arquivos não torna a conta anônima nem remove cópias do histórico que já tenham sido baixadas por terceiros.
