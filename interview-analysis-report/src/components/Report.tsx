import React from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Clock, 
  MessageSquare, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2,
  Search,
  Brain,
  Code,
  Briefcase
} from 'lucide-react';

// --- Types ---

interface TableProps {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  className?: string;
}

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  id: string;
}

interface ChainNodeProps {
  title: string;
  content: React.ReactNode;
  type: 'question' | 'answer' | 'clarification' | 'trigger';
  time?: string;
}

// --- Components ---

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.5 }}
    className={`bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const Badge = ({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "amber" | "red" | "zinc" }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    zinc: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color]}`}>
      {children}
    </span>
  );
};

const Table = ({ headers, rows, className = "" }: TableProps) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full text-sm text-left">
      <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
        <tr>
          {headers.map((h, i) => (
            <th key={i} className="px-6 py-3 font-medium tracking-wider">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
            {row.map((cell, j) => (
              <td key={j} className="px-6 py-4 text-zinc-700 whitespace-pre-wrap">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Section = ({ title, icon, children, id }: SectionProps) => (
  <section id={id} className="scroll-mt-24 mb-12">
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex items-center gap-3 mb-6"
    >
      <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-md shadow-indigo-200">
        {icon}
      </div>
      <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{title}</h2>
    </motion.div>
    {children}
  </section>
);

const DialogueChain = ({ title, steps }: { title: string, steps: { type: string, content: string | React.ReactNode, label?: string, time?: string }[] }) => (
  <Card className="mb-6">
    <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
      <h3 className="font-semibold text-zinc-900">{title}</h3>
    </div>
    <div className="p-6">
      <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
        {steps.map((step, idx) => (
          <motion.div 
            key={idx} 
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="relative"
          >
            <div className={`absolute -left-[29px] w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white
              ${step.type === 'question' ? 'border-blue-500 text-blue-500' : 
                step.type === 'trigger' ? 'border-amber-500 text-amber-500' : 
                step.type === 'clarification' ? 'border-purple-500 text-purple-500' :
                'border-emerald-500 text-emerald-500'}`}>
              <div className={`w-2 h-2 rounded-full ${
                 step.type === 'question' ? 'bg-blue-500' : 
                 step.type === 'trigger' ? 'bg-amber-500' : 
                 step.type === 'clarification' ? 'bg-purple-500' :
                 'bg-emerald-500'
              }`} />
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider
                  ${step.type === 'question' ? 'text-blue-600' : 
                    step.type === 'trigger' ? 'text-amber-600' : 
                    step.type === 'clarification' ? 'text-purple-600' :
                    'text-emerald-600'}`}>
                  {step.label || (step.type === 'question' ? '面试官提问' : step.type === 'trigger' ? '触发关键词' : step.type === 'clarification' ? '面试官澄清' : '候选人回答')}
                </span>
                {step.time && <span className="text-xs text-zinc-400 font-mono">{step.time}</span>}
              </div>
              
              <div className={`text-sm leading-relaxed ${step.type === 'trigger' ? 'font-mono text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 inline-block' : 'text-zinc-700'}`}>
                {step.content}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </Card>
);

// --- Main Report Component ---

export default function Report() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50 bg-opacity-90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              R
            </div>
            <h1 className="text-lg font-bold text-zinc-900 hidden sm:block">面试对话分析报告</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span className="flex items-center gap-1"><User size={14} /> 小米创新 AI 产品经理（实习）</span>
            <span className="hidden sm:flex items-center gap-1"><Clock size={14} /> 2026-03-03</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block lg:col-span-3">
            <nav className="sticky top-24 space-y-1">
              {[
                { id: 'basic-info', label: '一、基本信息', icon: User },
                { id: 'questions', label: '二、面试官问题列表', icon: MessageSquare },
                { id: 'chains', label: '三、对话链分析', icon: TrendingUp },
                { id: 'focus', label: '四、面试官关注图谱', icon: Target },
                { id: 'summary', label: '五、候选人表现摘要', icon: CheckCircle2 },
              ].map((item) => (
                <a 
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-600 rounded-lg hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all group"
                >
                  <item.icon size={16} className="group-hover:text-indigo-600 transition-colors" />
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-9 space-y-12">
            
            {/* 1. Basic Info */}
            <Section id="basic-info" title="一、基本信息" icon={<User size={20} />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <div className="px-6 py-4 border-b border-zinc-100 font-semibold text-zinc-900">角色识别</div>
                  <Table 
                    headers={['角色', 'Speaker', '判定依据']}
                    rows={[
                      [<Badge color="blue">候选人</Badge>, 'Speaker 1', '开场自我介绍，描述实习经历（小美、德国、北脑），回答问题'],
                      [<Badge color="zinc">面试官</Badge>, 'Speaker 2', '使用引导句持续提问，说明后续流程'],
                    ]}
                  />
                </Card>
                
                <Card>
                  <div className="px-6 py-4 border-b border-zinc-100 font-semibold text-zinc-900">面试时长</div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">总时长</span>
                      <span className="font-mono font-medium">~24分41秒</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs text-zinc-500 pt-2">
                      <div>
                        <p>自我介绍: ~67s</p>
                        <p>正式问答: ~68s - 1310s</p>
                      </div>
                      <div className="text-right">
                        <p className="text-indigo-600 font-bold text-sm">有效问答: ~20分钟</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </Section>

            {/* 2. Questions List */}
            <Section id="questions" title="二、面试官问题列表" icon={<MessageSquare size={20} />}>
              <Card>
                <Table 
                  headers={['编号', '问题文本', '类型']}
                  rows={[
                    ['Q1', '你之前是偏脑研究方向的，后来转到美团 AI 产品，转型过程中遇到了什么困难或问题？整体工作感受上对比如何？', <Badge color="zinc">预设</Badge>],
                    ['Q2', '在做小美的时候，你主要做了评测相关的工作，能更详细地讲讲——从模型评估到评测标准制定的思路，以及你在里面负责什么样的工作？', <Badge color="blue">追问</Badge>],
                    ['Q3', '（澄清）真的有用户会这么问问题吗？就是一个以上主观条件和三个以上客观条件这样子？', <Badge color="amber">澄清</Badge>],
                    ['Q4', '你刚刚讲的那些事情，里面哪些是你参与比较重的，还是说都是你完全自己完成的？', <Badge color="blue">追问</Badge>],
                    ['Q5', '哪些是你主动发现要做的事情，哪些是导师觉得需要做而分配给你的？', <Badge color="blue">追问</Badge>],
                    ['Q6', '你说因为发现一分率比较多，然后去主导了用户调研——这个"一分率"是怎么得出来的？是评测团队评的，还是用户反馈收集的？', <Badge color="blue">追问</Badge>],
                    ['Q7', '你整体感受下来，这个 APP 你日常会去用吗？', <Badge color="zinc">预设</Badge>],
                    ['Q8', '最近有没有看到什么有意思的 AI 应用？', <Badge color="zinc">预设</Badge>],
                    ['Q9', '其他没有觉得特别印象深刻的吗？包括日常应用场景——你觉得 AI 大模型 / Agent 这一套，有哪些是真的能用起来、能产生价值的场景？', <Badge color="blue">追问</Badge>],
                    ['Q10', '你平时有自己做一些小应用之类的吗？比如 dashboard，或者用 AI 编程做一些小工具？', <Badge color="zinc">预设</Badge>],
                    ['Q11', '你最近在做的另外一个东西，是什么类型的产品？', <Badge color="blue">追问</Badge>],
                    ['Q12', '用现成的 AI 工具（比如 Claude）不满足你需求的点是什么？', <Badge color="blue">追问</Badge>],
                    ['Q13', '实习时间方面：大概能适应多久？什么时候能到岗？', <Badge color="zinc">预设</Badge>],
                    ['Q14', '你在用 AI 编程的时候，有没有遇到什么困难？包括后端、部署这些方面的问题？', <Badge color="zinc">预设</Badge>],
                    ['Q15', '你之前有搭过数据库吗？', <Badge color="blue">追问</Badge>],
                  ]}
                />
                <div className="bg-zinc-50 p-4 border-t border-zinc-100 flex gap-4 text-sm text-zinc-600">
                  <span className="font-medium">统计：</span>
                  <span>预设问题: 6</span>
                  <span>追问: 8</span>
                  <span>澄清: 1</span>
                </div>
              </Card>
            </Section>

            {/* 3. Dialogue Chains */}
            <Section id="chains" title="三、对话链分析" icon={<TrendingUp size={20} />}>
              
              <DialogueChain 
                title="链条 A：职业转型经历"
                steps={[
                  { type: 'question', label: 'Q1 预设', content: '你之前是脑研究方向，转型到美团 AI 产品遇到了什么困难？' },
                  { type: 'answer', time: '68s~173s', content: '早在 GPT3.5 出来就开始使用；加入美团最初做模型测评标准制定；困难主要是不知道怎么和正式员工合作，但靠主动提问解决了。' },
                  { type: 'trigger', content: '我主要做了评测相关的工作' },
                  { type: 'question', label: 'Q2 追问', content: '详细讲讲评测标准的制定思路，以及你负责什么样的工作' }
                ]}
              />

              <DialogueChain 
                title="链条 B：到餐 Deep Search 评测工作（核心对话链）"
                steps={[
                  { type: 'question', label: 'Q2 追问', content: '详细讲讲评测标准的制定思路' },
                  { type: 'answer', time: '198s~263s', content: '介绍"到餐 deep search"场景；分流标准：1个以上主观条件 + 3个以上客观条件，总条件数>4' },
                  { type: 'trigger', content: '起码要有1个以上主观条件以及3个以上客观条件' },
                  { type: 'clarification', label: 'Q3 澄清', content: '真的有用户会这么问问题吗？' },
                  { type: 'answer', time: '271s~555s', content: '举例验证（5道口和望京聚餐）；用户意图拆分（MECE分类）；两层标准（严苛+放宽）；用户访谈（4人可用性测试）；发现问题（无法分享、文案不清）；工具调用优化（过照/漏照，准照率提升12%）。' },
                  { type: 'trigger', content: '刚刚讲的所有...我一共做了5个月' },
                  { type: 'question', label: 'Q4 追问', content: '里面哪些是你参与比较重的？还是全都自己完成的？' },
                  { type: 'answer', time: '566s~630s', content: '确认：所有内容全程参与，5个月跟到底。' },
                  { type: 'trigger', content: '用户访谈是我非常主动主导去做的' },
                  { type: 'question', label: 'Q5 追问', content: '哪些是你主动发现要做的，哪些是导师分配的？' },
                  { type: 'answer', time: '585s~630s', content: '用户访谈完全自己主导；因直带 mentor 做通用搜索，所以找了负责到餐 deep search 的同事合作。' },
                  { type: 'trigger', content: '因为发现一分比较多，然后主导用户调研' },
                  { type: 'question', label: 'Q6 追问', content: '这个"一分率"是评测团队评的还是用户反馈收集的？' },
                  { type: 'answer', time: '651s~736s', content: '评测团队评出；任务完成定义：走到团购下单子 agent 这一步；发现用户可能直接去大众点评导致误判；调研目的是重新定义任务完成率。' }
                ]}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DialogueChain 
                  title="链条 D：AI 应用认知"
                  steps={[
                    { type: 'question', label: 'Q8 预设', content: '最近有没有看到什么有意思的 AI 应用？' },
                    { type: 'answer', time: '804s~882s', content: '提到 Open Claude；亮点：多个 Claude 实例通过邮件平台相互共享信息、互相学习。' },
                    { type: 'trigger', content: '多个 cloud 之间相互打通信息' },
                    { type: 'question', label: 'Q9 追问', content: '还有其他印象深刻的吗？真正能用起来、产生价值的场景？' },
                    { type: 'answer', time: '914s~1037s', content: 'Sora 2.0；朋友想做演员平台+数字人；极梦 AI 生成视频；Sora 2.0 工业可用水平。' }
                  ]}
                />
                
                <DialogueChain 
                  title="链条 E：个人 AI 编程实践"
                  steps={[
                    { type: 'question', label: 'Q10 预设', content: '你平时有自己做一些小应用之类的吗？' },
                    { type: 'answer', time: '1054s~1069s', content: '有做个人网页；最近在做另一个东西，还没做完。' },
                    { type: 'trigger', content: '最近在做另一个东西，但还没有做完' },
                    { type: 'question', label: 'Q11 追问', content: '最近在做的是什么类型的产品？' },
                    { type: 'answer', time: '1076s~1159s', content: '学习规划工具；核心功能：输入领域 → 生成知识树 → 匹配收藏资料。' },
                    { type: 'trigger', content: '为什么不用现成的 Claude 这些工具' },
                    { type: 'question', label: 'Q12 追问', content: '这件事用 Claude 不能做吗？它不满足你需求的点是在哪里？' },
                    { type: 'answer', time: '1169s~1178s', content: '想要更可视化的呈现方式。' }
                  ]}
                />
              </div>
            </Section>

            {/* 4. Focus Map */}
            <Section id="focus" title="四、面试官关注图谱" icon={<Target size={20} />}>
              <Card className="mb-6">
                <div className="px-6 py-4 border-b border-zinc-100 font-semibold text-zinc-900">话题深度热力图</div>
                <Table 
                  headers={['话题', '追问层数', '涉及问题', '关注等级']}
                  rows={[
                    ['到餐 Deep Search 评测工作全链路', '4层', 'Q2 → Q3 → Q4 → Q5 → Q6', <Badge color="red">极高关注</Badge>],
                    ['个人 AI 编程实践 / 自建产品', '3层', 'Q10 → Q11 → Q12', <Badge color="amber">高关注</Badge>],
                    ['AI 应用认知与产品判断', '2层', 'Q8 → Q9', <Badge color="blue">中等关注</Badge>],
                    ['AI 编程能力 / 技术底子', '2层', 'Q14 → Q15', <Badge color="blue">中等关注</Badge>],
                    ['职业转型经历', '1层', 'Q1', <Badge color="zinc">低关注</Badge>],
                    ['美团 APP 使用体验', '0层', 'Q7', <Badge color="zinc">一带而过</Badge>],
                  ]}
                />
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 bg-red-50/50 border-red-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-600 mt-1 shrink-0" size={20} />
                    <div>
                      <h3 className="font-bold text-red-900 mb-2">极高关注：产品评测能力</h3>
                      <p className="text-sm text-red-800 leading-relaxed">
                        面试官花最多时间（约 9 分钟）深挖评测工作。核心考察点：
                        <ul className="list-disc pl-4 mt-2 space-y-1">
                          <li>技术方案的合理性</li>
                          <li>工作的深度与广度（是否主导）</li>
                          <li>主动性 vs 被动执行</li>
                          <li>指标定义的严谨性</li>
                        </ul>
                        <div className="mt-3 font-semibold text-red-900">
                          核心问题：候选人能不能真正独立驱动产品，还是只是执行者？
                        </div>
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-amber-50/50 border-amber-100">
                  <div className="flex items-start gap-3">
                    <Search className="text-amber-600 mt-1 shrink-0" size={20} />
                    <div>
                      <h3 className="font-bold text-amber-900 mb-2">高关注：自驱力与产品感</h3>
                      <p className="text-sm text-amber-800 leading-relaxed">
                        追问个人项目及为何不用现成工具，验证：
                        <ul className="list-disc pl-4 mt-2 space-y-1">
                          <li>候选人是否真的有产品感（痛点来自自身真实需求）</li>
                          <li>是否有持续学习和自驱的习惯</li>
                          <li>技术实现能力边界在哪里</li>
                        </ul>
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </Section>

            {/* 5. Summary */}
            <Section id="summary" title="五、候选人表现摘要" icon={<CheckCircle2 size={20} />}>
              <div className="space-y-6">
                <Card>
                  <div className="px-6 py-4 border-b border-zinc-100 font-semibold text-zinc-900 flex items-center gap-2">
                    <Briefcase size={18} className="text-zinc-500" /> 关键背景
                  </div>
                  <Table 
                    headers={['项目', '内容']}
                    rows={[
                      ['主要实习经历', '美团小美 AI 产品（到餐 Deep Search，约5个月，2024.9~2025.2）'],
                      ['其他经历', '德国实习（脑科学数据处理，Python）；北脑（脑机接口行业）'],
                      ['学术背景', '国外在读，雅思7.5，德语可日常交流'],
                      ['技术工具', 'Claude Code、阿里云百炼（知识库）、AI编程工具链、前端（Web Coding）'],
                    ]}
                  />
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <div className="px-6 py-4 border-b border-zinc-100 font-semibold text-zinc-900 flex items-center gap-2">
                      <Brain size={18} className="text-zinc-500" /> 展现能力
                    </div>
                    <div className="p-6 space-y-4">
                      {[
                        { label: '产品思维', desc: '能从用户痛点出发定义功能，评估指标合理性' },
                        { label: '主动性', desc: '自发组织用户访谈，业余时间开发个人项目' },
                        { label: '数据/评测', desc: '有完整评测体系设计经验（分流、标准、COT）' },
                        { label: '工具优化', desc: '理解 Agent 机制，通过 Prompt 优化提升准照率 12%' },
                        { label: 'AI 认知', desc: '关注 Open Claude, Sora 2.0，能区分炫技与价值' },
                      ].map((item, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <div>
                            <span className="font-semibold text-zinc-900 text-sm">{item.label}：</span>
                            <span className="text-zinc-600 text-sm">{item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <div className="px-6 py-4 border-b border-zinc-100 font-semibold text-zinc-900 flex items-center gap-2">
                      <AlertTriangle size={18} className="text-zinc-500" /> 潜在风险
                    </div>
                    <div className="p-6 space-y-4">
                      {[
                        { label: '技术深度有限', desc: '无自建数据库经验，AI 编程依赖高层工具' },
                        { label: 'AI 应用认知稍浅', desc: '对"真正有价值的 Agent 场景"未给出系统性回答' },
                        { label: '项目神秘感', desc: '对在建项目"不方便说"的态度可能给人保守印象' },
                        { label: '经历连贯性', desc: '脑科学 → AI 产品跨度较大，需评估转型动机' },
                      ].map((item, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                          <div>
                            <span className="font-semibold text-zinc-900 text-sm">{item.label}：</span>
                            <span className="text-zinc-600 text-sm">{item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </Section>

            <footer className="text-center text-zinc-400 text-sm py-12 border-t border-zinc-200 mt-12">
              <p>本报告由 AI 分析层（Claude claude-sonnet-4-6）依据 CLAUDE.md 5步分析流程生成</p>
              <p className="mt-1">原始数据来源：讯飞 ASR v2 转写结构化 JSON</p>
            </footer>

          </main>
        </div>
      </div>
    </div>
  );
}
