
/* ----------------------------------------------- */
const express = require('express');
const indexRouter = require('./routes/index');
const port = process.env.PORT || 4000;
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const cron = require('node-cron');

const duplicateExpiredEvents = require('./functions/updateEvent');
const deleteExpiredEvents = require('./functions/deleteEvent');

const http = require('http');
const hostname = '127.0.0.1';

//inicialización
const app = express();
app.use(express.json({limit: '10mb'}));
app.use(express.static('public'));

//setting
app.set('port', port);

//middlewares
app.use(cors({origin: "*"}));
app.use(express.json());

//Crea el server con http y lo vincula con express
const server = http.createServer(app);

server.listen(port,hostname, () => {
    console.log(`Servidor corriendo en http://${hostname} y puerto ${port}`);
});

// Crear stream para guardar logs(Debug)
//const logStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

// Usar morgan con el stream(Debug)
//app.use(morgan('combined', { stream: logStream }));

app.use('/', indexRouter);

//Prueba para debug
app.get('/prueba', (req, res) => {
    res.send('Exito');
});

// Programar la función para que se ejecute todos los días a las 6:00 AM
cron.schedule('0 6 * * *', () => {
    console.log('Ejecutando tarea diaria de verificación de eventos finalizados a las 6:00 AM');
    duplicateExpiredEvents();
    deleteExpiredEvents();
});