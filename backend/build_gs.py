import os
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
core=open(os.path.join(R,'assets','core.js'),encoding='utf-8').read().replace("if (typeof module !== 'undefined') module.exports = OnionCore;\n","")
gs=open(os.path.join(R,'backend','sheets.gs'),encoding='utf-8').read()+'\n\n'+open(os.path.join(R,'backend','bot.gs'),encoding='utf-8').read()
open(os.path.join(R,'backend','Code.gs'),'w',encoding='utf-8').write(gs+'\n\n/* ====================== Правила магазина (общие с сайтом) ====================== */\n'+core)
print('Code.gs', os.path.getsize(os.path.join(R,'backend','Code.gs')))
