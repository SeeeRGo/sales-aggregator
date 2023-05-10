FROM node:18-alpine
RUN apk update
RUN apk upgrade
RUN apk add --update alpine-sdk linux-headers git zlib-dev openssl-dev gperf php cmake
RUN git clone https://github.com/tdlib/td.git
RUN cd td
RUN rm -rf build
RUN mkdir build
RUN cd /td
RUN cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX:PATH=./tdlib .
RUN cd build
RUN cmake --build . --target install
RUN cd ..
RUN cd ..
RUN ls -l td/tdlib
WORKDIR /app
COPY package.json package.json
COPY . .
RUN npm install
CMD node server.js