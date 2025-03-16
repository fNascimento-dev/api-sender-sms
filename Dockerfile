FROM node:20-alpine

WORKDIR /usr/app

ENV TZ=America/Sao_Paulo

COPY package*.json ./
#RUN npm install --production
RUN npm install ci

RUN npm install -g pm2

COPY . .

CMD ["pm2-runtime", "start", "ecosystem.config.js"]
