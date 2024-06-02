FROM node:16

WORKDIR /tightrope

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "src"]
