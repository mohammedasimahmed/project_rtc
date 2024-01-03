const express = require("express");
const cors = require("cors");
const http = require("http");
const app = express();
const server = http.createServer(app);

app.use(cors());

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection",(socket)=>{
    console.log("connected with client")
    socket.on("callId",(callId)=>{
      socket.broadcast.emit("callId",callId)
      console.log(callId)
    })
    socket.on("offer",({offer})=>{
      socket.broadcast.emit("offer",offer)
      // console.log(offer)
    })
    socket.on("answer",(answer)=>{
      socket.broadcast.emit("answer",answer)
    })
    socket.on("ice_candidate",({ice_candidate,type})=>{
      socket.broadcast.emit("ice_candidate",{ice_candidate})
    })

})

server.listen(5000, () => console.log("Server started at port 5000"));
