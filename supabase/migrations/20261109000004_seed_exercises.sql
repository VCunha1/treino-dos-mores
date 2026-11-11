-- Biblioteca inicial de exercícios do sistema (owner_id nulo): legíveis por todos,
-- alterados apenas por migrations. Vídeo/imagem (media_url) ficam vazios até haver
-- fontes confiáveis; usuários podem criar exercícios próprios com link.

insert into public.exercises (owner_id, name, primary_muscle, secondary_muscles, equipment, description, instructions, safety_notes)
values
-- PEITORAL
(null, 'Supino reto com barra', 'peitoral', '{triceps,ombros}', 'Barra e banco', 'Exercício base para o peitoral.', 'Deite no banco, desça a barra controlada até a linha do peito e empurre até estender os braços.', 'Mantenha os pés firmes no chão e use um parceiro ou os suportes de segurança em cargas altas.'),
(null, 'Supino reto com halteres', 'peitoral', '{triceps,ombros}', 'Halteres e banco', 'Permite maior amplitude e trabalho unilateral.', 'Desça os halteres na linha do peito com os cotovelos levemente abertos e empurre sem bater um no outro.', 'Evite descer além do que o ombro tolera.'),
(null, 'Supino inclinado com halteres', 'peitoral', '{ombros,triceps}', 'Halteres e banco inclinado', 'Enfatiza a parte superior do peitoral.', 'Banco entre 30° e 45°. Desça controlado e empurre sem elevar os ombros.', 'Inclinações muito altas passam a carga para os ombros.'),
(null, 'Supino inclinado com barra', 'peitoral', '{ombros,triceps}', 'Barra e banco inclinado', 'Variação com barra para o peitoral superior.', 'Desça a barra até a parte alta do peito e empurre até estender os braços.', 'Use os suportes de segurança.'),
(null, 'Crucifixo com halteres', 'peitoral', '{ombros}', 'Halteres e banco', 'Isolador do peitoral.', 'Com cotovelos levemente flexionados, abra os braços até sentir alongar e feche em arco.', 'Não desça além do conforto do ombro; use cargas moderadas.'),
(null, 'Crucifixo na máquina (peck deck)', 'peitoral', '{ombros}', 'Máquina peck deck', 'Isolador guiado do peitoral.', 'Ajuste o banco para os cotovelos ficarem na altura do peito e una os braços à frente.', 'Evite estender demais os ombros para trás.'),
(null, 'Crossover na polia', 'peitoral', '{ombros}', 'Polia dupla', 'Tensão constante no peitoral.', 'Com o tronco levemente inclinado, una as mãos à frente em arco.', NULL),
(null, 'Flexão de braço', 'peitoral', '{triceps,ombros,abdomen}', 'Peso corporal', 'Exercício básico com o peso do corpo.', 'Corpo alinhado da cabeça aos pés; desça o peito até perto do chão e empurre.', 'Se perder o alinhamento do quadril, apoie os joelhos.'),
(null, 'Supino máquina', 'peitoral', '{triceps,ombros}', 'Máquina de supino', 'Opção guiada, boa para iniciantes.', 'Ajuste o banco para as pegadas ficarem na altura do peito e empurre até estender.', NULL),
-- COSTAS
(null, 'Puxada frontal na polia', 'costas', '{biceps,antebraco}', 'Polia alta', 'Base para o desenvolvimento do dorsal.', 'Puxe a barra até a altura do queixo/peito levando os cotovelos para baixo e para trás.', 'Evite balançar o tronco para ajudar na puxada.'),
(null, 'Barra fixa', 'costas', '{biceps,antebraco}', 'Barra fixa', 'Exercício com o peso do corpo para o dorsal.', 'Pendure-se com pegada pronada e puxe até o queixo passar a barra.', 'Use elástico ou máquina assistida se ainda não completar as repetições.'),
(null, 'Remada curvada com barra', 'costas', '{biceps,posterior_coxa,antebraco}', 'Barra', 'Exercício composto para a espessura das costas.', 'Tronco inclinado com coluna neutra; puxe a barra em direção ao abdômen.', 'Mantenha a coluna neutra; reduza a carga se curvar as costas.'),
(null, 'Remada baixa na polia', 'costas', '{biceps,antebraco}', 'Polia baixa', 'Trabalha a região média das costas.', 'Sentado, puxe o triângulo ao abdômen unindo as escápulas e retorne controlando.', 'Evite jogar o tronco para trás.'),
(null, 'Remada unilateral com halter', 'costas', '{biceps,antebraco}', 'Halter e banco', 'Remada unilateral com boa amplitude.', 'Apoie mão e joelho no banco e puxe o halter até a lateral do tronco.', NULL),
(null, 'Remada cavalinho', 'costas', '{biceps,antebraco}', 'Máquina ou barra T', 'Variação para a espessura das costas.', 'Puxe a carga ao abdômen mantendo o peito apoiado ou o tronco firme.', NULL),
(null, 'Pulldown com braços estendidos', 'costas', '{triceps}', 'Polia alta', 'Isolador do dorsal.', 'Com braços quase estendidos, desça a barra em arco até as coxas.', NULL),
(null, 'Levantamento terra', 'costas', '{posterior_coxa,gluteos,antebraco}', 'Barra', 'Exercício composto de corpo inteiro.', 'Barra rente às pernas, coluna neutra; empurre o chão e estenda quadril e joelhos.', 'Técnica é prioridade; comece leve e peça avaliação de um profissional.'),
-- OMBROS
(null, 'Desenvolvimento com halteres', 'ombros', '{triceps}', 'Halteres', 'Base para o ombro.', 'Empurre os halteres acima da cabeça sem arquear a lombar.', 'Evite compensar com a lombar; use banco com encosto se preciso.'),
(null, 'Desenvolvimento com barra', 'ombros', '{triceps}', 'Barra', 'Exercício composto para os ombros.', 'Empurre a barra acima da cabeça com o abdômen contraído.', NULL),
(null, 'Elevação lateral', 'ombros', '{}', 'Halteres', 'Isolador do deltoide lateral.', 'Eleve os braços até a altura dos ombros com cotovelos levemente flexionados.', 'Use carga que permita controle; evite balançar o corpo.'),
(null, 'Elevação frontal', 'ombros', '{peitoral}', 'Halteres', 'Trabalha o deltoide anterior.', 'Eleve os halteres à frente até a altura dos ombros.', NULL),
(null, 'Crucifixo inverso', 'ombros', '{costas}', 'Halteres ou máquina', 'Trabalha o deltoide posterior.', 'Com tronco inclinado, abra os braços para trás unindo as escápulas.', NULL),
(null, 'Face pull', 'ombros', '{costas}', 'Polia com corda', 'Saúde do ombro e parte posterior.', 'Puxe a corda em direção ao rosto abrindo os cotovelos.', NULL),
(null, 'Encolhimento com halteres', 'ombros', '{costas,antebraco}', 'Halteres', 'Trabalha o trapézio superior.', 'Eleve os ombros em direção às orelhas sem girar.', NULL),
-- BÍCEPS
(null, 'Rosca direta com barra', 'biceps', '{antebraco}', 'Barra', 'Base para o bíceps.', 'Cotovelos junto ao corpo, flexione e desça controlando.', 'Evite balançar o tronco.'),
(null, 'Rosca alternada com halteres', 'biceps', '{antebraco}', 'Halteres', 'Permite supinar o punho durante o movimento.', 'Alterne os braços, girando a palma para cima na subida.', NULL),
(null, 'Rosca martelo', 'biceps', '{antebraco}', 'Halteres', 'Enfatiza braquial e antebraço.', 'Pegada neutra (palmas frente a frente); flexione sem girar o punho.', NULL),
(null, 'Rosca Scott', 'biceps', '{}', 'Banco Scott e barra', 'Isola o bíceps com o braço apoiado.', 'Apoie os braços no banco e flexione sem tirar os cotovelos.', 'Não estenda totalmente o cotovelo com carga alta.'),
(null, 'Rosca na polia', 'biceps', '{antebraco}', 'Polia baixa', 'Tensão constante no bíceps.', 'Flexione os cotovelos mantendo-os fixos ao lado do corpo.', NULL),
-- TRÍCEPS
(null, 'Tríceps na polia (pushdown)', 'triceps', '{}', 'Polia alta', 'Isolador do tríceps.', 'Cotovelos fixos ao lado do corpo; estenda os braços para baixo.', NULL),
(null, 'Tríceps testa', 'triceps', '{}', 'Barra W e banco', 'Isolador clássico do tríceps.', 'Deitado, flexione os cotovelos levando a barra em direção à testa e estenda.', 'Mantenha os cotovelos apontando para cima, sem abrir.'),
(null, 'Tríceps francês com halter', 'triceps', '{}', 'Halter', 'Trabalha a cabeça longa do tríceps.', 'Com o halter atrás da cabeça, estenda os braços para cima.', NULL),
(null, 'Mergulho no banco', 'triceps', '{ombros,peitoral}', 'Banco', 'Peso corporal para o tríceps.', 'Mãos no banco, desça o corpo flexionando os cotovelos e empurre.', 'Evite descer demais para não sobrecarregar o ombro.'),
(null, 'Paralelas (mergulho)', 'triceps', '{peitoral,ombros}', 'Barras paralelas', 'Exercício composto com peso corporal.', 'Desça controlado e empurre até estender os braços.', 'Evite se tiver desconforto no ombro.'),
-- ANTEBRAÇO
(null, 'Rosca de punho', 'antebraco', '{}', 'Barra ou halteres', 'Fortalece os flexores do antebraço.', 'Antebraços apoiados, flexione apenas os punhos.', NULL),
(null, 'Rosca inversa', 'antebraco', '{biceps}', 'Barra', 'Trabalha extensores do antebraço e braquiorradial.', 'Pegada pronada, flexione os cotovelos sem balançar.', NULL),
-- QUADRÍCEPS
(null, 'Agachamento livre', 'quadriceps', '{gluteos,posterior_coxa,abdomen}', 'Barra e rack', 'Exercício composto base para as pernas.', 'Desça com o quadril para trás e joelhos alinhados aos pés, depois suba empurrando o chão.', 'Use os suportes de segurança; técnica antes de carga.'),
(null, 'Agachamento no smith', 'quadriceps', '{gluteos}', 'Smith machine', 'Versão guiada do agachamento.', 'Pés um pouco à frente da barra; desça controlado e suba.', NULL),
(null, 'Leg press 45°', 'quadriceps', '{gluteos,posterior_coxa}', 'Leg press', 'Composto guiado para as pernas.', 'Desça até onde mantiver o quadril encostado no banco e empurre.', 'Não trave totalmente os joelhos no topo.'),
(null, 'Cadeira extensora', 'quadriceps', '{}', 'Máquina extensora', 'Isolador do quadríceps.', 'Estenda os joelhos e desça controlando.', 'Evite cargas que causem desconforto no joelho.'),
(null, 'Afundo (avanço)', 'quadriceps', '{gluteos,posterior_coxa}', 'Halteres ou peso corporal', 'Trabalho unilateral para as pernas.', 'Dê um passo à frente e desça até os dois joelhos formarem ângulos próximos de 90°.', NULL),
(null, 'Agachamento búlgaro', 'quadriceps', '{gluteos}', 'Banco e halteres', 'Agachamento unilateral exigente.', 'Pé de trás apoiado no banco; desça com o tronco estável.', 'Comece sem carga para dominar o equilíbrio.'),
(null, 'Agachamento hack', 'quadriceps', '{gluteos}', 'Máquina hack', 'Composto guiado com ênfase no quadríceps.', 'Costas apoiadas; desça controlado e empurre.', NULL),
-- POSTERIOR DE COXA
(null, 'Mesa flexora', 'posterior_coxa', '{panturrilhas}', 'Máquina flexora deitada', 'Isolador do posterior de coxa.', 'Flexione os joelhos levando o rolo em direção aos glúteos.', NULL),
(null, 'Cadeira flexora', 'posterior_coxa', '{}', 'Máquina flexora sentada', 'Isolador sentado do posterior.', 'Flexione os joelhos puxando o apoio para baixo e para trás.', NULL),
(null, 'Stiff com barra', 'posterior_coxa', '{gluteos,costas}', 'Barra', 'Trabalha posterior de coxa e glúteos.', 'Joelhos levemente flexionados, leve o quadril para trás com a coluna neutra.', 'Pare de descer quando sentir a coluna perder a posição neutra.'),
(null, 'Stiff com halteres', 'posterior_coxa', '{gluteos,costas}', 'Halteres', 'Versão com halteres do stiff.', 'Quadril para trás com coluna neutra, halteres rentes às pernas.', NULL),
-- GLÚTEOS
(null, 'Elevação pélvica', 'gluteos', '{posterior_coxa}', 'Barra e banco', 'Principal exercício de ativação dos glúteos.', 'Costas apoiadas no banco; eleve o quadril até alinhar tronco e coxas e contraia.', 'Use almofada na barra e evite hiperestender a lombar.'),
(null, 'Ponte de glúteos', 'gluteos', '{posterior_coxa}', 'Peso corporal', 'Versão simples da elevação pélvica.', 'Deitada, eleve o quadril contraindo os glúteos.', NULL),
(null, 'Abdução de quadril na máquina', 'gluteos', '{}', 'Máquina abdutora', 'Trabalha glúteo médio.', 'Abra as pernas contra a resistência e retorne controlando.', NULL),
(null, 'Coice na polia', 'gluteos', '{posterior_coxa}', 'Polia baixa com tornozeleira', 'Isolador dos glúteos.', 'Estenda a perna para trás sem arquear a lombar.', NULL),
(null, 'Agachamento sumô', 'gluteos', '{quadriceps}', 'Halter ou barra', 'Agachamento com base ampla.', 'Pés afastados com pontas para fora; desça com o tronco ereto.', NULL),
-- PANTURRILHAS
(null, 'Panturrilha em pé', 'panturrilhas', '{}', 'Máquina ou degrau', 'Trabalha o gastrocnêmio.', 'Eleve os calcanhares ao máximo e desça alongando.', NULL),
(null, 'Panturrilha sentada', 'panturrilhas', '{}', 'Máquina sentada', 'Trabalha o sóleo.', 'Com joelhos flexionados, eleve os calcanhares e desça controlando.', NULL),
(null, 'Panturrilha no leg press', 'panturrilhas', '{}', 'Leg press', 'Alternativa para panturrilha.', 'Apoie a ponta dos pés na plataforma e empurre com os tornozelos.', 'Não trave os joelhos.'),
-- ABDÔMEN
(null, 'Abdominal crunch', 'abdomen', '{}', 'Peso corporal', 'Flexão do tronco para o reto abdominal.', 'Eleve ombros e parte alta das costas sem puxar o pescoço.', 'Não puxe a cabeça com as mãos.'),
(null, 'Prancha', 'abdomen', '{ombros,gluteos}', 'Peso corporal', 'Isometria para o core.', 'Apoie antebraços e pontas dos pés mantendo o corpo alinhado.', 'Interrompa se a lombar ceder.'),
(null, 'Elevação de pernas', 'abdomen', '{}', 'Barra fixa ou banco', 'Trabalha a parte inferior do abdômen.', 'Eleve as pernas controlando, sem balançar.', NULL),
(null, 'Abdominal na polia', 'abdomen', '{}', 'Polia alta com corda', 'Abdominal com carga.', 'Ajoelhado, flexione o tronco levando os cotovelos aos joelhos.', NULL),
(null, 'Prancha lateral', 'abdomen', '{ombros}', 'Peso corporal', 'Isometria para os oblíquos.', 'Apoie o antebraço e lateral do pé, mantendo o corpo alinhado.', NULL),
-- OUTROS
(null, 'Caminhada na esteira', 'outros', '{}', 'Esteira', 'Aquecimento ou condicionamento leve.', 'Mantenha ritmo confortável e postura ereta.', NULL),
(null, 'Bicicleta ergométrica', 'outros', '{quadriceps}', 'Bicicleta', 'Aquecimento ou condicionamento de baixo impacto.', 'Ajuste o banco e pedale em ritmo constante.', NULL),
(null, 'Alongamento geral', 'outros', '{}', 'Peso corporal', 'Mobilidade e alongamento ao final do treino.', 'Mantenha cada posição de forma confortável, sem dor.', 'Não force além do conforto.')
on conflict do nothing;
