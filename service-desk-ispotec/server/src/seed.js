require("dotenv").config();
const prisma = require("./utils/db");
const { hashPassword } = require("./utils/auth");

(async () => {
  const categories = ["Tecnologias de Informação","Impressão e Documentos","Sistemas Académicos","Infraestruturas","Recursos Humanos","Administrativo","Outro"];
  for (const name of categories) await prisma.category.upsert({ where: { name }, update: {}, create: { name } });

  const users = [
    ["Administrador","admin@ispotec.local","Admin@123","Administração","ADMIN"],
    ["Técnico de Suporte","tecnico@ispotec.local","Tecnico@123","Tecnologias de Informação","TECNICO"],
    ["Colaborador Demo","colaborador@ispotec.local","Colaborador@123","Administração","COLABORADOR"]
  ];
  for (const [name,email,password,department,role] of users) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name,email,passwordHash: await hashPassword(password),department,role }
    });
  }

  const settings = {
    LIMITE_PAGINAS: "10",
    ANTECEDENCIA_MINIMA_HORAS: "48",
    SLA_RULES: JSON.stringify({
      BAIXA:{first:48,resolution:120},
      MEDIA:{first:24,resolution:72},
      ALTA:{first:8,resolution:24},
      CRITICA:{first:2,resolution:4}
    })
  };
  for (const [key,value] of Object.entries(settings)) await prisma.setting.upsert({where:{key},update:{value},create:{key,value}});
  console.log("Seed concluído.");
  await prisma.$disconnect();
})();
