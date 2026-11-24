// Criterion texts for the Portuguese reports. Keys are criterion ids (queries.ts).
import type { CriterionText } from "./types";
export const PT: Record<string, CriterionText> = {
  i1: {
    label: "Cobertura de CPU dos hosts",
    description: "Percentual de hosts monitorados com métricas ativas de uso de CPU de qualquer origem (OneAgent, OTel, integração de nuvem).",
    action: "Implante o OneAgent em todos os hosts para coletar métricas de uso de CPU, ou faça a ingestão via OTel/integração de nuvem.",
  },
  i2: {
    label: "Cobertura de memória dos hosts",
    description: "Percentual de hosts monitorados com métricas ativas de uso de memória.",
    action: "Verifique a coleta de métricas de memória pelo OneAgent. Ative o monitoramento de memória nas configurações do host.",
  },
  i3: {
    label: "Cobertura de disco dos hosts",
    description: "Percentual de hosts monitorados com métricas ativas de utilização de disco.",
    action: "Garanta que o monitoramento de disco esteja ativado nas configurações do OneAgent para ter visibilidade da utilização de armazenamento.",
  },
  i4: {
    label: "Cobertura de disponibilidade dos hosts",
    description: "Percentual de hosts monitorados com métricas de disponibilidade — base para relatórios de SLA.",
    action: "Confirme que as métricas de disponibilidade dos hosts estão sendo coletadas. Revise as configurações de monitoramento de hosts e de SLA.",
  },
  i29: {
    label: "Hosts de aplicação em full-stack",
    description: "Percentual dos hosts que rodam processos de aplicação (Java, .NET, Node.js, PHP, IIS) monitorados pelo OneAgent em modo full-stack. Um host só em modo infraestrutura roda essas aplicações sem traces nem serviços.",
    action: "Passe para full-stack os hosts que rodam aplicações, para que o OneAgent instrumente seus processos.",
  },
  i30: {
    label: "Módulos de código do OneAgent atualizados",
    description: "Percentual dos módulos de código do OneAgent rodando a versão instalada do agente. Um módulo desatualizado (Fleet Management: AGENT_OUTDATED) espera o processo reiniciar.",
    action: "Reinicie os processos que o Fleet Management lista como desatualizados para que carreguem a versão instalada do OneAgent.",
  },
  i31: {
    label: "Hosts reportando",
    description: "Percentual dos hosts vistos nos últimos 7 dias que ainda reportaram nos últimos 30 minutos. Nós de Kubernetes ficam de fora: entram e saem por design.",
    action: "Verifique os hosts que pararam de reportar: OneAgent parado, caminho de rede até o ActiveGate, ou host desativado sem ser removido.",
  },
  i32: {
    label: "Hosts previstos monitorados",
    description: "Hosts que reportam ao Dynatrace contra os hosts que o projeto prevê monitorar.",
    action: "Instale o OneAgent (ou conecte o OpenTelemetry) nos hosts previstos que ainda não reportam.",
  },
  i33: {
    label: "Clusters Kubernetes previstos monitorados",
    description: "Clusters Kubernetes que reportam ao Dynatrace contra os clusters que o projeto prevê monitorar.",
    action: "Conecte os clusters Kubernetes previstos com o Dynatrace Operator.",
  },
  d16: {
    label: "Aplicações previstas monitoradas",
    description: "Aplicações web e mobile monitoradas contra as aplicações que o projeto prevê monitorar.",
    action: "Ative o Real User Monitoring nas aplicações web e mobile previstas que ainda não são monitoradas.",
  },
  i27: {
    label: "Monitoramento de dispositivos de rede",
    description: "Percentual dos dispositivos de rede (switches, roteadores, firewalls, access points) que enviam métricas do dispositivo.",
    action: "Inclua todos os dispositivos de rede na configuração de monitoramento SNMP para que enviem CPU, memória e uptime.",
  },
  i28: {
    label: "Status das interfaces de rede",
    description: "Percentual das interfaces dos dispositivos de rede que reportam seu status operacional.",
    action: "Inclua as interfaces dos dispositivos na configuração de monitoramento SNMP para que cada uma reporte status e tráfego.",
  },
  i5: {
    label: "Cobertura de rede dos hosts",
    description: "Percentual de hosts monitorados com entidades de interface de rede.",
    action: "Ative o monitoramento de rede nas configurações do OneAgent para obter métricas de tráfego por interface nos hosts.",
  },
  i6: {
    label: "Cobertura de CPU dos processos",
    description: "Percentual de process groups com métricas ativas de uso de CPU.",
    action: "Ative o monitoramento em nível de processo no OneAgent para capturar métricas de uso de CPU por processo.",
  },
  i7: {
    label: "Cobertura de clusters K8s",
    description: "Percentual de clusters Kubernetes com monitoramento ativo de workloads.",
    action: "Conecte os clusters Kubernetes usando o Dynatrace Operator para ter monitoramento full-stack de K8s.",
  },
  i8: {
    label: "Cobertura de entidades de disco dos hosts",
    description: "Percentual de hosts com entidades de disco detectadas.",
    action: "Verifique se as entidades de disco são detectadas nos hosts. Ative o monitoramento de disco nas configurações do OneAgent.",
  },
  i9: {
    label: "Cobertura de problemas do Davis",
    description: "Percentual de hosts cobertos pela detecção de problemas do Davis AI.",
    action: "Verifique se o Davis AI está ativado e se as configurações de detecção de anomalias estão definidas para a infraestrutura.",
  },
  i10: {
    label: "Cobertura de workloads de nuvem",
    description: "Percentual de namespaces K8s com workloads cloud-native em execução.",
    action: "Ative a integração com a plataforma de nuvem (AWS, Azure, GCP) para descobrir workloads K8s cloud-native.",
  },
  i11: {
    label: "Topologia host-processo",
    description: "Percentual de hosts com process groups detectados — valida a descoberta de relacionamentos entre entidades.",
    action: "Garanta que o OneAgent esteja em execução nos hosts para que os process groups sejam detectados automaticamente no mapeamento de topologia.",
  },
  i12: {
    label: "Mapeamento de workloads K8s",
    description: "Percentual de clusters Kubernetes com pelo menos um namespace de aplicação de nuvem detectado — valida a topologia de workloads.",
    action: "Verifique se os workloads em nível de namespace K8s são detectados pelo Dynatrace Operator para compor a topologia de workloads.",
  },
  i13: {
    label: "Enriquecimento de logs de hosts com nuvem",
    description: "Percentual de hosts com contexto do provedor de nuvem nos dados de log — valida que a integração de nuvem alimenta os metadados em nível de host.",
    action: "Ative a integração com a plataforma de nuvem e verifique se os logs em nível de host incluem o metadado cloud.provider.",
  },
  i14: {
    label: "Enriquecimento de logs com nuvem",
    description: "Percentual de registros de log enriquecidos com metadados do provedor de nuvem.",
    action: "Configure a integração de nuvem para enriquecer os registros de log com o contexto cloud.provider via OpenPipeline.",
  },
  i15: {
    label: "Enriquecimento com região de nuvem",
    description: "Percentual de logs enriquecidos com nuvem que também contêm metadados de região — valida a profundidade da observabilidade multirregião.",
    action: "Garanta que a integração de nuvem inclua o atributo cloud.region. Verifique a cobertura multirregião nos dados de log.",
  },
  i16: {
    label: "Enriquecimento com AZ de nuvem",
    description: "Percentual de logs enriquecidos com nuvem que têm metadados de zona de disponibilidade — valida a observabilidade de resiliência entre domínios de falha.",
    action: "Ative os metadados de zona de disponibilidade na integração de nuvem para ter visibilidade dos domínios de falha.",
  },
  i17: {
    label: "Enriquecimento com conta de nuvem",
    description: "Percentual de logs enriquecidos com nuvem que têm metadados de ID da conta — valida a governança de nuvem multiconta.",
    action: "Configure a integração de nuvem para incluir cloud.account.id e viabilizar a governança multiconta.",
  },
  i19: {
    label: "Profundidade do monitoramento de nodes K8s",
    description: "Percentual de nodes Kubernetes que reportam métricas de recursos de contêiner — valida o monitoramento de computação em nível de node.",
    action: "Garanta que o Dynatrace Operator esteja coletando métricas em nível de node dos clusters K8s.",
  },
  i20: {
    label: "Cobertura de métricas por namespace de nuvem",
    description: "Percentual de namespaces K8s com métricas ativas de contêiner — valida a observabilidade dos workloads de nuvem.",
    action: "Verifique se as métricas de contêiner em nível de namespace K8s estão chegando pelo Dynatrace Operator.",
  },
  i21: {
    label: "Monitoramento de reinícios de contêiner",
    description: "Percentual de namespaces K8s com rastreamento de reinícios de contêiner — essencial para detectar CrashLoopBackOff e problemas de OOM.",
    action: "Ative o rastreamento de reinícios de contêiner pelo Dynatrace Operator para detectar CrashLoopBackOff e OOMKill.",
  },
  i22: {
    label: "Limites de recursos de contêiner",
    description: "Percentual de namespaces K8s com limites de recursos definidos — essencial para a estabilidade do cluster e a governança de recursos.",
    action: "Defina limites de recursos de CPU/memória nos workloads K8s para garantir estabilidade e governança do cluster.",
  },
  i23: {
    label: "Problemas com causa raiz",
    description: "Parcela dos problemas do Davis em entidades de infraestrutura (hosts, processos, Kubernetes, nuvem, dispositivos customizados) nas últimas 72h em que o Davis identificou uma entidade de causa raiz.",
    action: "Elimine as lacunas de monitoramento nas entidades afetadas para que o Davis consiga atribuir uma causa raiz; revise os problemas que terminam sem ela.",
  },
  i24: {
    label: "Problemas com resposta automatizada",
    description: "Parcela dos problemas do Davis em entidades de infraestrutura (hosts, processos, Kubernetes, nuvem, dispositivos customizados) nas últimas 72h que acionaram pelo menos uma execução de workflow.",
    action: "Crie um workflow acionado por problemas que encaminhe o problema ao responsável (ITSM, chat) ou execute uma remediação pré-aprovada.",
  },
  i25: {
    label: "Workflows de automação de infraestrutura",
    description: "Workflows que executaram uma ação de nuvem, Kubernetes ou gerenciamento de configuração (conectores AWS, Azure, GCP, Kubernetes, Ansible) nas últimas 24h.",
    action: "Adicione a um workflow uma ação de conector de nuvem ou Kubernetes, por exemplo para reiniciar, escalar ou aplicar tag a um recurso quando um problema for aberto.",
  },
  i26: {
    label: "Uso de Assist, MCP e dtctl",
    description: "Pessoas que consultaram métricas e topologia pelo Dynatrace Assist, por um cliente MCP ou pela CLI dtctl nos últimos 30 dias.",
    action: "Apresente o Dynatrace Assist à equipe responsável por esses dados e conecte a IDE ou o agente de código dela por meio do servidor MCP da Dynatrace ou do dtctl.",
  },
  a18: {
    label: "Processos de aplicação instrumentados",
    description: "Percentual dos processos de aplicação (Java, .NET, Node.js, PHP, IIS) em hosts full-stack que rodam um módulo de código do OneAgent, como o Fleet Management mostra. Processo sem módulo não gera traces nem serviços.",
    action: "Reinicie os processos de aplicação que subiram antes do OneAgent e confirme que a injeção automática está ligada nesses hosts (ou que o Dynatrace Operator injeta os pods).",
  },
  a2: {
    label: "Cobertura de métodos de serviços",
    description: "Percentual de serviços com tracing em nível de método.",
    action: "Ative o tracing em nível de método nas configurações do serviço. Use regras de sensor para obter visibilidade mais profunda.",
  },
  a5: {
    label: "Cobertura de tempo de resposta",
    description: "Percentual de serviços com métricas de tempo de resposta (p95).",
    action: "Confirme que as métricas de tempo de resposta dos serviços (p95) estão chegando. Ative os percentis de tempo de resposta nas configurações.",
  },
  a6: {
    label: "Cobertura de rastreamento de falhas",
    description: "Percentual de serviços com métricas de taxa de falha.",
    action: "Ative as regras de detecção de falhas e verifique se as métricas de taxa de falha estão sendo capturadas nos serviços.",
  },
  a7: {
    label: "Cobertura de throughput",
    description: "Percentual de serviços com métricas de contagem de requisições/throughput.",
    action: "Verifique se as métricas de contagem de requisições e de throughput estão ativas. Revise as configurações de monitoramento dos serviços.",
  },
  a8: {
    label: "Cobertura de spans de banco de dados",
    description: "Percentual de serviços que consultam um banco de dados, pelas métricas de banco que a Dynatrace deriva dos spans (dt.service.database.query.count).",
    action: "Garanta que as chamadas a banco de dados sejam rastreadas. Ative a captura de requisições de banco de dados nas configurações do serviço.",
  },
  a9: {
    label: "Cobertura de spans de mensageria",
    description: "Percentual de serviços que publicam, recebem ou processam mensagens (Kafka, RabbitMQ, SQS), pelas métricas de mensageria que a Dynatrace deriva dos spans. Consumidores serverless que registram a mensagem como invocação (por exemplo uma função Lambda acionada por SQS) não são contados.",
    action: "Ative o tracing de filas de mensagens para Kafka, RabbitMQ, SQS e outros sistemas de mensageria.",
  },
  a17: {
    label: "Serviços que chamam outros serviços",
    description: "Percentual de serviços que chamam ao menos um outro serviço, pelas relações de chamada que a Dynatrace constrói a partir dos traces distribuídos.",
    action: "Propague o contexto de trace entre os serviços (W3C traceparent) para que a Dynatrace construa as relações de chamada entre eles.",
  },
  a11: {
    label: "Mapeamento serviço-processo",
    description: "Percentual de serviços com process groups associados — valida a topologia entre serviço e infraestrutura.",
    action: "Verifique se os serviços têm process groups associados para o mapeamento da topologia entre serviço e infraestrutura.",
  },
  a13: {
    label: "Profundidade de chamadas a banco de dados",
    description: "Percentual dos serviços que chamam bancos de dados e alcançam 2+ sistemas de banco, pelas métricas de banco que a Dynatrace deriva dos spans.",
    action: "Ative o tracing profundo de chamadas a banco de dados nos serviços. Garanta que os serviços conectados a vários sistemas de banco de dados tenham todos os atributos db.system rastreados.",
  },
  a14: {
    label: "Problemas com causa raiz",
    description: "Parcela dos problemas do Davis em serviços e filas nas últimas 72h em que o Davis identificou uma entidade de causa raiz.",
    action: "Elimine as lacunas de monitoramento nas entidades afetadas para que o Davis consiga atribuir uma causa raiz; revise os problemas que terminam sem ela.",
  },
  a15: {
    label: "Problemas com resposta automatizada",
    description: "Parcela dos problemas do Davis em serviços e filas nas últimas 72h que acionaram pelo menos uma execução de workflow.",
    action: "Crie um workflow acionado por problemas que encaminhe o problema ao responsável (ITSM, chat) ou execute uma remediação pré-aprovada.",
  },
  a16: {
    label: "Uso de Assist, MCP e dtctl",
    description: "Pessoas que consultaram traces pelo Dynatrace Assist, por um cliente MCP ou pela CLI dtctl nos últimos 30 dias.",
    action: "Apresente o Dynatrace Assist à equipe responsável por esses dados e conecte a IDE ou o agente de código dela por meio do servidor MCP da Dynatrace ou do dtctl.",
  },
  d1: {
    label: "Cobertura de ações RUM",
    description: "Percentual de aplicações web com métricas ativas de ações de usuário.",
    action: "Crie uma aplicação web na Dynatrace e injete o snippet JavaScript do RUM para rastrear as ações de usuário.",
  },
  d2: {
    label: "Cobertura de rastreamento de sessões",
    description: "Percentual de aplicações web com rastreamento de sessões ativo.",
    action: "Ative o rastreamento de sessões na configuração da sua aplicação RUM para capturar as sessões de usuário.",
  },
  d3: {
    label: "Cobertura de LCP",
    description: "Percentual de aplicações web com métricas de Largest Contentful Paint — Core Web Vital.",
    action: "Ative a captura de Largest Contentful Paint (LCP) nas configurações do RUM. Otimize para atingir <2.5s.",
  },
  d4: {
    label: "Cobertura de INP",
    description: "Percentual de aplicações web com métricas de Interaction to Next Paint — Core Web Vital.",
    action: "Ative o rastreamento de Interaction to Next Paint (INP) nas configurações do RUM. Meta: <200ms.",
  },
  d5: {
    label: "Cobertura de CLS",
    description: "Percentual de aplicações web com métricas de Cumulative Layout Shift — Core Web Vital.",
    action: "Ative o rastreamento de Cumulative Layout Shift (CLS) nas configurações do RUM. Meta: CLS <0.1.",
  },
  d6: {
    label: "Cobertura de erros de frontend",
    description: "Percentual de aplicações web com rastreamento de erros ativado.",
    action: "Ative o rastreamento de erros de JavaScript nas configurações da aplicação RUM para ter visibilidade dos erros de frontend.",
  },
  d7: {
    label: "Cobertura de Synthetic HTTP",
    description: "Percentual de aplicações web cobertas por monitores Synthetic HTTP.",
    action: "Crie monitores HTTP no Synthetic Monitoring para verificar a disponibilidade e os tempos de resposta dos endpoints.",
  },
  d8: {
    label: "Cobertura de Synthetic de navegador",
    description: "Percentual de aplicações web cobertas por testes Synthetic de navegador.",
    action: "Crie monitores de navegador do tipo clickpath para simular jornadas de usuário e detectar regressões.",
  },
  d9: {
    label: "Cobertura de aplicativos móveis",
    description: "Percentual do total de aplicações que têm monitoramento móvel.",
    action: "Integre o Dynatrace Mobile SDK (iOS/Android) aos seus aplicativos nativos para ter RUM móvel.",
  },
  d10: {
    label: "Diversidade de locais Synthetic",
    description: "Razão entre locais Synthetic e o total de monitores Synthetic.",
    action: "Adicione vários locais Synthetic (públicos e/ou privados) para ampliar a cobertura geográfica.",
  },
  d11: {
    label: "Cobertura de disponibilidade Synthetic",
    description: "Razão entre monitores Synthetic e aplicações web — valida o monitoramento proativo de disponibilidade.",
    action: "Crie monitores Synthetic e verifique se as métricas de disponibilidade das execuções são capturadas.",
  },
  d12: {
    label: "Problemas com causa raiz",
    description: "Parcela dos problemas do Davis em aplicações web e móveis e em monitores Synthetic nas últimas 72h em que o Davis identificou uma entidade de causa raiz.",
    action: "Elimine as lacunas de monitoramento nas entidades afetadas para que o Davis consiga atribuir uma causa raiz; revise os problemas que terminam sem ela.",
  },
  d13: {
    label: "Problemas com resposta automatizada",
    description: "Parcela dos problemas do Davis em aplicações web e móveis e em monitores Synthetic nas últimas 72h que acionaram pelo menos uma execução de workflow.",
    action: "Crie um workflow acionado por problemas que encaminhe o problema ao responsável (ITSM, chat) ou execute uma remediação pré-aprovada.",
  },
  d14: {
    label: "Verificações Synthetic executadas por workflows",
    description: "Workflows que executaram uma execução Synthetic sob demanda nas últimas 24h.",
    action: "Adicione uma execução Synthetic sob demanda a um workflow, por exemplo para confirmar a recuperação após um deploy ou uma remediação.",
  },
  d15: {
    label: "Uso de Assist, MCP e dtctl",
    description: "Pessoas que consultaram sessões e eventos de usuário pelo Dynatrace Assist, por um cliente MCP ou pela CLI dtctl nos últimos 30 dias.",
    action: "Apresente o Dynatrace Assist à equipe responsável por esses dados e conecte a IDE ou o agente de código dela por meio do servidor MCP da Dynatrace ou do dtctl.",
  },
  l1: {
    label: "Cobertura de logs de hosts",
    description: "Percentual de hosts que enviaram dados de log nas últimas 2h.",
    action: "Ative a ingestão de logs via OneAgent nos hosts. Verifique se os logs em nível de host estão chegando ao Grail.",
  },
  l2: {
    label: "Cobertura de logs de serviços",
    description: "Percentual de serviços com dados de log associados.",
    action: "Verifique se os dados de log estão associados aos serviços. Ative a coleta de logs nos hosts de aplicação.",
  },
  l3: {
    label: "Logs correlacionados a traces",
    description: "Percentual de registros de log enriquecidos com trace_id.",
    action: "Garanta que o trace_id seja incluído na saída de log. Use o enriquecimento automático do OneAgent ou logging estruturado.",
  },
  l4: {
    label: "Logs enriquecidos com entidade",
    description: "Percentual de registros de log enriquecidos com o contexto da entidade host.",
    action: "Ative o enriquecimento com a entidade host (dt.entity.host) pela coleta de logs do OneAgent ou pelo OpenPipeline.",
  },
  l5: {
    label: "Correlação de logs com process group",
    description: "Percentual de registros de log enriquecidos com o contexto de process group.",
    action: "Ative o enriquecimento com process group nas configurações de ingestão de logs para permitir a análise de logs em nível de serviço.",
  },
  l6: {
    label: "Diversidade de fontes de log",
    description: "Razão entre fontes de log distintas e o total de hosts — valida a abrangência da ingestão de logs na infraestrutura.",
    action: "Adicione fontes de log de várias camadas (aplicação, infraestrutura, K8s, nuvem). Configure integrações de log adicionais.",
  },
  l7: {
    label: "Cobertura de logs de erro",
    description: "Percentual de serviços cujos logs incluem entradas de nível ERROR.",
    action: "Garanta que os serviços emitam logs de nível ERROR. Configure regras de processamento de logs para capturar a severidade de erro.",
  },
  l8: {
    label: "Cobertura de logs de K8s",
    description: "Percentual de namespaces K8s com dados de log.",
    action: "Implante o Dynatrace Operator ou o Fluent Bit no K8s para capturar logs de pods/contêineres com metadados de K8s.",
  },
  l9: {
    label: "Diversidade de severidade de logs",
    description: "Percentual de níveis de severidade ingeridos (de 5: ERROR, WARN, INFO, DEBUG, TRACE).",
    action: "Garanta que as aplicações emitam logs em vários níveis de severidade (ERROR, WARN, INFO, DEBUG, TRACE).",
  },
  l12: {
    label: "Logging estruturado",
    description: "Percentual de logs com conteúdo JSON estruturado, que facilita o parsing e a análise.",
    action: "Configure as aplicações para emitir logs em JSON estruturado. Use regras de processamento do OpenPipeline para fazer o parsing de logs não estruturados.",
  },
  l13: {
    label: "Logs correlacionados a spans",
    description: "Percentual de logs enriquecidos com span_id para vinculação granular entre trace e log (mais profunda do que apenas o trace_id).",
    action: "Configure a autoinstrumentação do OpenTelemetry para injetar o span_id nos logs. Em Java, use MDC; em .NET, use ILogger com o contexto de Activity.",
  },
  l14: {
    label: "Logging de hosts com várias fontes",
    description: "Percentual de hosts que recebem logs de 2+ fontes distintas — indica distribuição equilibrada de logs.",
    action: "Ative várias fontes de log por host: logs de aplicação via OneAgent, sistema/syslog, logs de auditoria de segurança e logs cloud-native.",
  },
  l15: {
    label: "Eventos baseados em logs",
    description: "Presença de eventos gerados a partir de dados de log — indica alertas baseados em logs já estabelecidos.",
    action: "Crie regras de eventos baseados em logs em Settings → Log Events. Defina padrões para erros críticos, segurança e entradas críticas para o negócio.",
  },
  l16: {
    label: "Enriquecimento de logs com dispositivos customizados",
    description: "Percentual de logs enriquecidos com entidades de dispositivo customizado para contexto ampliado.",
    action: "Registre dispositivos customizados via API e enriqueça os logs com o atributo dt.entity.custom_device para correlação específica do domínio.",
  },
  l17: {
    label: "Uso de Assist, MCP e dtctl",
    description: "Pessoas que consultaram logs pelo Dynatrace Assist, por um cliente MCP ou pela CLI dtctl nos últimos 30 dias.",
    action: "Apresente o Dynatrace Assist à equipe responsável por esses dados e conecte a IDE ou o agente de código dela por meio do servidor MCP da Dynatrace ou do dtctl.",
  },
  l18: {
    label: "Pipelines de log customizados configurados",
    description: "Pipelines de log que a equipe configurou no OpenPipeline para filtrar, mascarar, enriquecer ou rotear logs antes do armazenamento. Lido das configurações, sem varredura de dados.",
    action: "Crie um pipeline de log no OpenPipeline para as principais fontes de log: mascare campos sensíveis, descarte ruído e roteie os registros para o bucket correto.",
  },
  s13: {
    label: "Runtime Vulnerability Analytics ativo",
    description: "Relatórios de estado de vulnerabilidades do Runtime Vulnerability Analytics nas últimas 2 horas.",
    action: "Ative o Runtime Vulnerability Analytics nas configurações de Application Security.",
  },
  s1: {
    label: "Cobertura de vulnerabilidades em runtime",
    description: "Parcela dos process groups avaliados pelo Runtime Vulnerability Analytics nas últimas 2 horas.",
    action: "Ative o Runtime Vulnerability Analytics e garanta que os processos monitorados estejam cobertos pelas regras de monitoramento.",
  },
  s2: {
    label: "Achados de segurança de terceiros",
    description: "Ferramentas de segurança externas (scanners, registries, segurança de nuvem) que enviaram achados de vulnerabilidade à Dynatrace nas últimas 24 horas.",
    action: "Faça a ingestão dos achados dos seus scanners, registries e ferramentas de segurança de nuvem para que todos os sinais de segurança fiquem junto do contexto de runtime.",
  },
  s11: {
    label: "Runtime Application Protection",
    description: "Detecções de ataque do Runtime Application Protection nas últimas 24 horas.",
    action: "Ative o Runtime Application Protection para que ataques a código vulnerável sejam detectados e possam ser bloqueados.",
  },
  s12: {
    label: "Security Posture Management",
    description: "Achados de conformidade do Security Posture Management nas últimas 2 horas.",
    action: "Ative o Security Posture Management para avaliar a configuração de Kubernetes e de nuvem em relação a padrões de conformidade.",
  },
  s14: {
    label: "Uso de Assist, MCP e dtctl",
    description: "Pessoas que consultaram achados de segurança pelo Dynatrace Assist, por um cliente MCP ou pela CLI dtctl nos últimos 30 dias.",
    action: "Apresente o Dynatrace Assist à equipe responsável por esses dados e conecte a IDE ou o agente de código dela por meio do servidor MCP da Dynatrace ou do dtctl.",
  },
  s16: {
    label: "Vulnerabilidades com avaliação do Davis",
    description: "Percentual de vulnerabilidades críticas e altas em aberto para as quais o Davis avaliou se há ativos de dados alcançáveis, nas últimas 2h. Com esse contexto, a vulnerabilidade é priorizada pelo risco real, não só pela severidade.",
    action: "Dê ao Davis o contexto para avaliar cada vulnerabilidade: monitore em full-stack os process groups afetados e os bancos de dados que eles chamam, para que os ativos de dados alcançáveis e a exposição sejam conhecidos.",
  },
  t4: {
    label: "Achados de detecção",
    description: "Detecções de ameaça que chegaram à Dynatrace nas últimas 24 horas, de qualquer origem.",
    action: "Envie as detecções de ameaça à Dynatrace, a partir do Runtime Application Protection ou de produtos de segurança externos.",
  },
  t12: {
    label: "Fontes externas de detecção",
    description: "Produtos de segurança que não são da Dynatrace e enviaram detecções (por exemplo, detecção de ameaças em nuvem ou proteção de endpoint) nas últimas 24 horas.",
    action: "Conecte produtos de detecção de ameaças em nuvem e de proteção de endpoint para que as detecções deles sejam investigadas com contexto de observabilidade.",
  },
  t13: {
    label: "Workflows de automação de segurança",
    description: "Workflows que executaram uma ação de segurança (por exemplo, enriquecer um observável durante uma investigação) nas últimas 24h.",
    action: "Adicione ações de segurança a um workflow, por exemplo para enriquecer um indicador ou abrir um caso quando uma detecção chegar.",
  },
  t14: {
    label: "Uso de Assist, MCP e dtctl",
    description: "Pessoas que consultaram achados de segurança pelo Dynatrace Assist, por um cliente MCP ou pela CLI dtctl nos últimos 30 dias.",
    action: "Apresente o Dynatrace Assist à equipe responsável por esses dados e conecte a IDE ou o agente de código dela por meio do servidor MCP da Dynatrace ou do dtctl.",
  },
  ai1: {
    label: "Cobertura de serviços com spans de IA",
    description: "Percentual de serviços com spans de IA/LLM.",
    action: "Instrumente as chamadas de IA/LLM com as convenções semânticas gen_ai do OpenTelemetry e exporte para a Dynatrace.",
  },
  ai2: {
    label: "Cobertura de rastreamento de tokens",
    description: "Percentual de spans de IA com rastreamento de uso de tokens.",
    action: "Adicione os atributos de uso de tokens (gen_ai.usage.input_tokens, gen_ai.usage.output_tokens) aos spans de IA.",
  },
  ai19: {
    label: "Modelo de resposta registrado",
    description: "Percentual de spans de IA que registram o modelo que de fato respondeu, para que uma mudança de versão do modelo possa ser rastreada.",
    action: "Registre gen_ai.response.model em todos os spans de IA, seguindo as convenções semânticas de GenAI do OpenTelemetry.",
  },
  ai3: {
    label: "Diversidade de provedores de IA",
    description: "Percentual de provedores de IA conhecidos detectados em relação aos esperados (de 5).",
    action: "Monitore vários provedores de IA. Adicione o atributo gen_ai.system para distinguir os fornecedores.",
  },
  ai4: {
    label: "Cobertura de invocações de agentes",
    description: "Percentual de spans de IA com tracing de invocação de agentes.",
    action: "Adicione o atributo gen_ai.agent.name aos spans para rastrear as invocações de agentes de IA.",
  },
  ai5: {
    label: "Cobertura de tracing de prompt/resposta",
    description: "Percentual de spans de IA com tracing de prompt ou de resposta.",
    action: "Ative a captura de prompt/resposta nos atributos dos spans de IA para fins de auditoria e conformidade.",
  },
  ai6: {
    label: "Cobertura de rastreamento de erros de IA",
    description: "Percentual de spans de IA com rastreamento de status de erro.",
    action: "Rastreie os erros de IA definindo o status do span como ERROR em falhas e timeouts do modelo.",
  },
  ai7: {
    label: "Cobertura de guardrails",
    description: "Percentual de spans de IA com monitoramento de guardrails.",
    action: "Implemente o monitoramento de guardrails com os atributos gen_ai.guardrail para conformidade de segurança.",
  },
  ai8: {
    label: "Cobertura de rastreamento de custo",
    description: "Percentual de spans de IA com as contagens de tokens e o modelo, de que o app AI Observability precisa para calcular o custo.",
    action: "Envie o uso de tokens (gen_ai.usage.input_tokens, gen_ai.usage.output_tokens) e o modelo (gen_ai.request.model) nos spans de IA para que o app AI Observability consiga calcular o custo.",
  },
  ai10: {
    label: "Tracing de chamadas de ferramentas por agentes",
    description: "Presença de execuções de ferramentas por agentes nos spans de IA (gen_ai.operation.name = execute_tool) nas últimas 72h.",
    action: "Instrumente os frameworks de agentes com as convenções de GenAI do OpenTelemetry para que as execuções de ferramentas apareçam como spans execute_tool.",
  },
  ai12: {
    label: "IA agêntica em uso",
    description: "Sessões agênticas do Dynatrace Assist nos últimos 30 dias (GENAI_EVENT com skill = operator).",
    action: "Ative a IA agêntica no Dynatrace Assist e conceda ai:operator:execute e as permissões do gateway MCP.",
  },
  ai18: {
    label: "dtctl operado por agentes de IA",
    description: "Pessoas cujo agente de código com IA (por exemplo, Claude Code) executou o dtctl nos últimos 30 dias.",
    action: "Dê aos agentes de código com IA acesso à Dynatrace pelo dtctl ou pelo servidor MCP, sob o mesmo IAM do usuário.",
  },
  ai14: {
    label: "Workflows agênticos",
    description: "Workflows que consumiram AI Units nos últimos 30 dias, como o SRE Agent executado a partir de um gatilho de problema.",
    action: "Adicione uma tarefa Run agent (SRE Agent) a um workflow acionado por problemas, com uma tarefa Request Approval antes de ações com consequências.",
  },
  ai15: {
    label: "Problemas com causa raiz",
    description: "Parcela dos problemas do Davis em serviços que chamam um LLM nas últimas 72h em que o Davis identificou uma entidade de causa raiz.",
    action: "Elimine as lacunas de monitoramento nas entidades afetadas para que o Davis consiga atribuir uma causa raiz; revise os problemas que terminam sem ela.",
  },
  ai16: {
    label: "Problemas com resposta automatizada",
    description: "Parcela dos problemas do Davis em serviços que chamam um LLM nas últimas 72h que acionaram pelo menos uma execução de workflow.",
    action: "Crie um workflow acionado por problemas que encaminhe o problema ao responsável (ITSM, chat) ou execute uma remediação pré-aprovada.",
  },
  b1: {
    label: "Cobertura de bizevents nos serviços",
    description: "Percentual de serviços com Business Events associados.",
    action: "Envie Business Events à Dynatrace pela Business Events API ou pela extração de logs no OpenPipeline.",
  },
  b2: {
    label: "Diversidade de tipos de bizevents",
    description: "Percentual de tipos de Business Events esperados que foram detectados (de 10 tipos de baseline).",
    action: "Defina vários tipos de evento para diferentes processos de negócio (pedidos, cadastros, pagamentos).",
  },
  b3: {
    label: "Eventos com contexto de serviço",
    description: "Percentual de Business Events vinculados a serviços.",
    action: "Enriqueça os Business Events com dt.entity.service para correlacionar o impacto no negócio em nível de serviço.",
  },
  b4: {
    label: "Diversidade de provedores de bizevents",
    description: "Percentual de provedores de Business Events esperados que foram detectados (de 5 provedores de baseline).",
    action: "Adicione o atributo event.provider para classificar os Business Events pelo sistema de origem.",
  },
  b5: {
    label: "Cobertura de dados de receita",
    description: "Percentual de Business Events com receita/valor monetário.",
    action: "Inclua campos de revenue/amount/value nos Business Events para a análise de impacto monetário.",
  },
  b6: {
    label: "Eventos vinculados a sessões",
    description: "Percentual de Business Events vinculados a sessões RUM.",
    action: "Vincule os Business Events às sessões RUM incluindo o atributo dt.rum.session_id.",
  },
  b7: {
    label: "Eventos vinculados a traces",
    description: "Percentual de Business Events correlacionados a traces distribuídos.",
    action: "Inclua o trace_id nos Business Events para ter rastreabilidade das transações de ponta a ponta.",
  },
  b9: {
    label: "Problemas com causa raiz",
    description: "Parcela dos problemas do Davis em serviços que emitem Business Events nas últimas 72h em que o Davis identificou uma entidade de causa raiz.",
    action: "Elimine as lacunas de monitoramento nas entidades afetadas para que o Davis consiga atribuir uma causa raiz; revise os problemas que terminam sem ela.",
  },
  b10: {
    label: "Problemas com resposta automatizada",
    description: "Parcela dos problemas do Davis em serviços que emitem Business Events nas últimas 72h que acionaram pelo menos uma execução de workflow.",
    action: "Crie um workflow acionado por problemas que encaminhe o problema ao responsável (ITSM, chat) ou execute uma remediação pré-aprovada.",
  },
  b11: {
    label: "Uso de Assist, MCP e dtctl",
    description: "Pessoas que consultaram Business Events pelo Dynatrace Assist, por um cliente MCP ou pela CLI dtctl nos últimos 30 dias.",
    action: "Apresente o Dynatrace Assist à equipe responsável por esses dados e conecte a IDE ou o agente de código dela por meio do servidor MCP da Dynatrace ou do dtctl.",
  },
  sd1: {
    label: "Cobertura de deploys nos serviços",
    description: "Percentual de serviços com um marcador de deploy (CUSTOM_DEPLOYMENT) nas últimas 24h.",
    action: "Ative o rastreamento de eventos de deploy nos serviços. Envie eventos CUSTOM_DEPLOYMENT a partir do CI/CD.",
  },
  sd2: {
    label: "Eventos de deploy de CI/CD",
    description: "Eventos de deploy de pipelines de CI/CD nas últimas 24h (SDLC_EVENT cujo tipo indica um deploy).",
    action: "Envie eventos de deploy a partir do CI/CD (Azure DevOps, GitHub, Argo CD) pelo modelo de eventos SDLC.",
  },
  sd11: {
    label: "Problemas com causa raiz",
    description: "Parcela dos problemas do Davis em entidades que receberam um deploy nas últimas 72h em que o Davis identificou uma entidade de causa raiz.",
    action: "Elimine as lacunas de monitoramento nas entidades afetadas para que o Davis consiga atribuir uma causa raiz; revise os problemas que terminam sem ela.",
  },
  sd12: {
    label: "Problemas com resposta automatizada",
    description: "Parcela dos problemas do Davis em entidades que receberam um deploy nas últimas 72h que acionaram pelo menos uma execução de workflow.",
    action: "Crie um workflow acionado por problemas que encaminhe o problema ao responsável (ITSM, chat) ou execute uma remediação pré-aprovada.",
  },
  sd13: {
    label: "Validação de release (Site Reliability Guardian)",
    description: "Validações do Site Reliability Guardian concluídas nas últimas 24h (Business Event guardian.validation.finished).",
    action: "Execute uma validação do Site Reliability Guardian a partir do pipeline após cada deploy para aprovar ou bloquear a release.",
  },
  sd14: {
    label: "Workflows de integração com pipelines",
    description: "Workflows que executaram uma ação de controle de código-fonte ou de CI/CD (conectores GitHub, GitLab, Jenkins, Azure DevOps) nas últimas 24h.",
    action: "Conecte a ferramenta de controle de código-fonte ou de CI/CD ao Workflows para que um evento do pipeline possa iniciar uma validação ou um rollback.",
  },
  g2: {
    label: "Atualização da versão do OneAgent",
    description: "Percentual de hosts cujo OneAgent foi compilado nos últimos 12 meses (data de build lida da versão instalada).",
    action: "Ative as atualizações automáticas do OneAgent, ou agende as atualizações em janelas de manutenção, para que nenhum host permaneça em um build com mais de 12 meses.",
  },
  g4: {
    label: "Logs com contexto de segurança",
    description: "Percentual de registros de log que trazem dt.security_context, o campo usado como filtro pelas políticas de acesso em nível de registro. Lido do fieldsSnapshot, sem varredura de dados brutos.",
    action: "Defina dt.security_context nas fontes de log ou no OpenPipeline e, em seguida, restrinja o acesso com policy boundaries sobre esse campo.",
  },
  g5: {
    label: "Sucesso das execuções de workflows",
    description: "Percentual de execuções de workflow concluídas nas últimas 24h que terminaram com sucesso.",
    action: "Revise os workflows que terminam com erro, corrija-os ou desative-os e crie alertas para execuções com falha.",
  },
  g6: {
    label: "Integração de ITSM ou chat nos workflows",
    description: "Workflows que executaram uma ação de ServiceNow, Jira, Slack, Microsoft Teams, PagerDuty ou e-mail nas últimas 24h.",
    action: "Adicione uma ação de ServiceNow, Jira, Slack ou Microsoft Teams aos workflows de problemas para que os incidentes cheguem às ferramentas da própria equipe.",
  },
  g8: {
    label: "Aprovação humana nos workflows",
    description: "Workflows que executaram uma tarefa de aprovação nos últimos 7 dias, para que uma pessoa confirme antes de uma ação com consequências.",
    action: "Adicione uma tarefa de aprovação antes das ações que alteram a produção, para que a automação de risco médio e alto aguarde uma pessoa.",
  },
  l11: {
    label: "Buckets de log dedicados",
    description: "Número de buckets distintos do Grail com dados de log (esperado >= 2 para a segregação adequada). Lido do fieldsSnapshot, sem varredura de dados brutos.",
    action: "Crie buckets dedicados no Grail para as diferentes camadas de log (segurança, aplicação, infraestrutura). Configure regras de roteamento no OpenPipeline.",
  },
  sd10: {
    label: "Atribuição de ownership",
    description: "Percentual de serviços com tags de ownership atribuídas — valida o mapeamento de responsabilidade das equipes na resposta a incidentes.",
    action: "Atribua tags de ownership aos serviços para mapear a responsabilidade das equipes e apoiar a resposta a incidentes.",
  },
  a12: {
    label: "Utilização de tags nos serviços",
    description: "Percentual de serviços com pelo menos uma tag atribuída — as tags viabilizam o rastreamento de releases, o ownership e a filtragem.",
    action: "Atribua tags aos serviços para o rastreamento de releases, o mapeamento de ownership e a filtragem.",
  },
  g9: {
    label: "Uso de Assist, MCP e dtctl",
    description: "Pessoas que consultaram eventos de uso da plataforma, auditoria e faturamento pelo Dynatrace Assist, por um cliente MCP ou pela CLI dtctl nos últimos 30 dias.",
    action: "Apresente o Dynatrace Assist à equipe responsável por esses dados e conecte a IDE ou o agente de código dela por meio do servidor MCP da Dynatrace ou do dtctl.",
  },
  g10: {
    label: "SLOs definidos",
    description: "Objetivos de nível de serviço configurados no ambiente, clássicos e do app Service-Level Objectives. Lido da configuração, sem varredura de dados.",
    action: "Defina um SLO para cada serviço crítico para o negócio, começando por disponibilidade e tempo de resposta.",
  },
  g11: {
    label: "Detectores de anomalia customizados configurados",
    description: "Detectores de anomalia que a equipe criou sobre suas próprias métricas e consultas. Lido das configurações, sem varredura de dados.",
    action: "Crie um detector de anomalia sobre uma métrica ou consulta DQL que seja relevante para o negócio e não esteja coberta pela detecção nativa.",
  },
  g12: {
    label: "Baselines adaptativos ou sazonais nos alertas",
    description: "Alertas avaliados nos últimos 7 dias com um baseline autoadaptativo ou sazonal em vez de um limite fixo.",
    action: "Migre os alertas sobre sinais com padrões diários ou semanais de um limite fixo para um baseline autoadaptativo ou sazonal.",
  },
  g14: {
    label: "Mascaramento de dados sensíveis em logs",
    description: "Regras de mascaramento de logs que estão ativas. As regras que acompanham a plataforma vêm desativadas, então só as ativas contam. Lido das configurações, sem varredura de dados.",
    action: "Ative as regras de mascaramento de logs que correspondem aos dados que as aplicações gravam (números de cartão, e-mails, credenciais) e crie regras para os identificadores próprios.",
  },
  g15: {
    label: "Mascaramento de atributos de spans",
    description: "Regras de mascaramento de atributos que estão ativas para traces. Lido das configurações, sem varredura de dados.",
    action: "Mascare os atributos de span que podem carregar dados pessoais, como URLs completas, query strings, identificadores de usuário e cabeçalhos de requisição.",
  },
  g16: {
    label: "Mascaramento de privacidade no RUM",
    description: "Percentual de aplicações web em que o RUM mascara dados pessoais em URLs ou nos nomes das ações de usuário. Lido das configurações, sem varredura de dados.",
    action: "Nas configurações de privacidade de dados de cada aplicação, ative o mascaramento de dados pessoais em URLs e dos nomes das ações de usuário.",
  },
  g17: {
    label: "Session Replay gravado com mascaramento",
    description: "Percentual de aplicações web cuja gravação do Session Replay usa um preset de mascaramento em vez de gravar tudo visível. Lido das configurações, sem varredura de dados.",
    action: "Mantenha um preset de mascaramento na gravação de cada aplicação com Session Replay e libere elementos individuais só onde o conteúdo é sabidamente inofensivo.",
  },
  g18: {
    label: "Buckets próprios com retenção definida",
    description: "Buckets do Grail criados pela equipe, cada um com a retenção escolhida, em vez de manter tudo nos buckets padrão. Lido da lista de buckets, sem varredura de dados.",
    action: "Crie buckets para os dados com necessidade própria de retenção, como auditoria, segurança ou depuração de curta duração, e direcione os registros para eles no OpenPipeline.",
  },
  g19: {
    label: "Trilha de auditoria consultada",
    description: "Pessoas que consultaram os eventos de auditoria da plataforma nos últimos 30 dias. Os eventos de auditoria são sempre gravados; aqui conta se alguém olha para eles.",
    action: "Dê um destino aos eventos de auditoria: um dashboard ou uma revisão agendada de quem alterou configurações, tokens e acessos.",
  },
  f1: {
    label: "Cálculo de custo e carbono em execução",
    description: "Workflows que executaram o cálculo do Cost & Carbon Optimization nas últimas 24h.",
    action: "Instale o Cost & Carbon Optimization pelo Hub e agende o workflow de cálculo.",
  },
  f2: {
    label: "Hosts com medição de carbono",
    description: "Percentual de hosts com uma medição de energia e carbono do Cost & Carbon Optimization nas últimas 6h.",
    action: "Verifique se o cálculo cobre todos os hosts monitorados; os hosts sem medição geralmente estão fora do escopo do workflow.",
  },
  f3: {
    label: "Gasto de nuvem ingerido",
    description: "Provedores de nuvem cujos dados de faturamento (formato FOCUS) foram importados para o Cost & Carbon Optimization nas últimas 30 horas (a importação é executada uma vez por dia).",
    action: "Configure a importação de custos de nuvem no Cost & Carbon Optimization para que a exportação de faturamento FOCUS do provedor seja carregada diariamente.",
  },
  f4: {
    label: "Gasto de nuvem com responsável",
    description: "Parcela do custo de nuvem importado cujas tags de faturamento indicam um responsável ou um centro de custo.",
    action: "Aplique tags de responsável ou de centro de custo aos recursos de nuvem no provedor, para que o custo importado possa ser atribuído.",
  },
  f5: {
    label: "Namespaces Kubernetes com medição de carbono",
    description: "Percentual de namespaces Kubernetes com uma medição de energia e carbono nas últimas 6h.",
    action: "Inclua os clusters Kubernetes no cálculo de carbono para que cada namespace tenha sua própria medição.",
  },
  f6: {
    label: "Hosts em uso ativo",
    description: "Percentual de hosts medidos cujo uso médio de CPU nas últimas 6h é igual ou superior a 3%, o limite de ociosidade aplicado pelo Cost & Carbon Optimization.",
    action: "Revise os hosts abaixo do limite de ociosidade: desligue, consolide ou reduza o porte dos que não são necessários.",
  },
  f7: {
    label: "Gasto coberto por desconto por compromisso",
    description: "Parcela do custo de nuvem importado coberta por um desconto por compromisso (savings plan ou capacidade reservada).",
    action: "Revise os workloads estáveis pagos sob demanda e avalie um desconto por compromisso com o provedor de nuvem.",
  },
  f8: {
    label: "Energia em uso produtivo",
    description: "Parcela da energia medida nos hosts nas últimas 6h que não foi classificada como desperdiçada (CPU ociosa e seu overhead).",
    action: "Ajuste o dimensionamento dos hosts com baixo uso de CPU; a energia desperdiçada vem da capacidade que permanece ociosa.",
  },
  g3: {
    label: "Custo de monitoramento de hosts alocado",
    description: "Percentual de registros de faturamento de monitoramento de hosts nas últimas 24h que trazem um centro de custo (dt.cost.costcenter).",
    action: "Defina dt.cost.costcenter nos hosts (propriedades do host ou labels do Kubernetes) para que o uso de monitoramento de hosts seja alocado a um centro de custo.",
  },
  b8: {
    label: "Business Events com centro de custo",
    description: "Percentual de Business Events com dados de centro de custo ou de produto.",
    action: "Adicione os atributos dt.cost.costcenter e dt.cost.product para correlacionar FinOps e negócio.",
  },
};
