const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const app     = express();
const keys    = require('../settings/keys');
const path = require('path');
const cors = require('cors');
const fs = require("fs");
const Jimp = require("jimp");
const connection = require('../settings/connection');

const md5     = require('md5');
const jwt     = require('jsonwebtoken');
const save_image = require('../functions/saveImage');
const generateNumber = require('../functions/generateNumber');

const mercadopago = require('mercadopago');
require('dotenv').config();

/* ----------------------- POST --------------------------*/

//Funciones comunes

// Función para generar un eventId único
async function generateUniqueEventId() {
    let newId;
    let exists = true;
    while (exists) {
        newId = generateNumber(20); // Genera código alfanumérico de 20 caracteres
        exists = await checkIfEventIdExists(newId);
    }
    return newId;
}

// Función para verificar si el eventId existe en la base de datos
const checkIfEventIdExists = (newId) => {
    return new Promise((resolve, reject) => {
        const checkEventIdQuery = `SELECT eventId FROM event WHERE eventId = ?`;
        connection.con.query(checkEventIdQuery, [newId], (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result.length > 0); // Si existe un duplicado, devuelve true
        });
    });
};


// ----------------------------------------------------------------------------------------------

// SETTINGS

// Desbloquea la cuenta del usuario cundo se ingresa el código de activación asignado a dicha cuenta
router.post('/verificate-user', auth.verifyToken, async function(req, res, next){
    try{
        let {email, activationCode} = req.body;

        const checkCode = `SELECT * FROM user WHERE email = ? AND activationCode = ?`;
        connection.con.query(checkCode, [email, activationCode], (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    const activate = `UPDATE user SET status = 1 WHERE id = ?`;
                    connection.con.query(activate, result[0].id, (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else{
                            res.send({status: 1, data: result});
                        }
                    });
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Verifica la contraseña del usuario
router.post('/verificate-password', auth.verifyToken, async function(req, res, next){
    try{
        let {id, password} = req.body;

        const hashed_password = md5(password.toString())
        const checkPassword = `SELECT * FROM user WHERE id = ? AND password = ?`;
        connection.con.query(checkPassword, [id, hashed_password], (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    res.send({status: 1, data: result});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza la contraseña del usuario
router.post('/update-password', auth.verifyToken, async function(req, res, next){
    try {
        let {id, password} = req.body;

        const hashed_password = md5(password.toString())
        const sql = `UPDATE user SET password = ? WHERE id = ?`;
        connection.con.query(sql, [hashed_password, id], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                res.send({status: 1, data: result});
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza el correo electrónico del usuario
router.post('/update-email', auth.verifyToken, async function(req, res, next){
    try {
        let {id, email, status} = req.body;

        const sql = `UPDATE user SET email = ?, status = ? WHERE id = ?`;
        connection.con.query(sql, [email, status, id], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                res.send({status: 1, data: result})
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});


// PROFILE

// Obtener un perfíl desde un número de id(profileId)
router.post('/get-profile', async function(req, res, next){
    try{
        let {profileId} = req.body;
        const sql = `SELECT u.email, u.profileId, u.thumbnail, u.name, u.location, u.followers, u.followed 
                     FROM user AS u 
                     WHERE u.profileId = ?`;
        connection.con.query(sql, profileId, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    res.send({status: 1, data: result});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

//Edita el perfíl del usuario
router.post('/edit-profile', auth.verifyToken, async (req, res, next) => {
    try {
        let {profileId, name, location, thumbnail, prev_thumb} = req.body;
        let thumbnail_var = '';

        if(thumbnail.includes(';base64,')){
            await save_image(profileId, 'thumbnail', thumbnail, 350, 350, prev_thumb)
            .then( value => {
                if(value == 'error') throw 'error';
                else {
                    thumbnail = value;
                    if(prev_thumb !== thumbnail) {
                        thumbnail_var = (thumbnail)?`, thumbnail = "${thumbnail}"`:'';
                    }
                }
            } )
            .catch( error => {
                throw error;
            } )
        }
        const sql = `UPDATE user SET name = ?, location = ? ${thumbnail_var} WHERE profileId = ?`;
                    connection.con.query(sql, [name, location, profileId], (err, result, field) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            res.send({status: 1, data: result, UpdatedValues: {name: name, location: location, thumbnail: thumbnail}});
                        }
                    })
    } catch (error) {
        res.send({status: 0, data: error});
    }
    connection.con.end;
});

//Buscá perfiles desde la home
router.post('/search-users', async function(req, res, next){
    let {query} = req.body;

    if (!query) {
        return res.status(400).send({ status: 0, message: 'Query is required.' });
    }

    const sql = `SELECT * FROM user WHERE name LIKE ? OR email LIKE ? LIMIT 10`; // Ajusta la consulta según tu base de datos
    const likeQuery = `%${query}%`;

    connection.con.query(sql, [likeQuery, likeQuery], (err, results) => {
        if (err) {
            return res.status(500).send({ status: 0, data: err });
        }
        res.send({ status: 1, data: results });
    });
});

//Actualiza los seguidores
router.post('/update-followers', auth.verifyToken, async (req, res, next) => {
    try {
        const { profileId, ownerId, followed, followers } = req.body;

        // Primera consulta de actualización
        const sql1 = `UPDATE user AS u SET u.followed = ? WHERE u.profileId = ?`;
        connection.con.query(sql1, [followed, profileId], (err, result1) => {
            if (err) {
                res.send({ status: 0, data: 'Error 1' });
                return;
            }

            // Segunda consulta de actualización
            const sql2 = `UPDATE user AS u SET u.followers = ? WHERE u.profileId = ?`;
            connection.con.query(sql2, [followers, ownerId], (err, result2) => {
                if (err) {
                    res.send({ status: 0, data: 'Error 2' });
                    return;
                }

                // Ambas consultas exitosas
                res.send({ status: 1, data: { result1, result2 } });
            });
        });
    } catch (error) {
        res.send({ status: 0, data: error.message });
    }
});


//EVENT

//Obtiene el evento dado el eventId
router.post('/get-event', async function(req, res, next){
    try{
        let {eventId} = req.body;
        const sql = `SELECT  e.*, u.name AS userName, u.email, u.thumbnail
                     FROM event AS e
                     INNER JOIN user AS u ON u.profileId = e.profileId
                     WHERE eventId = ?`;
        connection.con.query(sql, eventId, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    res.send({status: 1, data: result});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

//Editár o crear un evento
router.post('/edit-event', auth.verifyToken, async (req, res, next) => {
    try {
        let {eventId, profileId, type, name, date, description, addGoal, goal, finalized} = req.body;
        let arr = [];
        let sql;

        if(typeof((eventId) == 'string') && eventId.length) {
            //Edita un evento
            sql = `UPDATE event AS e SET e.type=?,e.date=?,e.name=?,e.description=?,e.goal=?,finalized=? WHERE e.eventId = ?`;
            arr = [type, date, name, description, goal, finalized, eventId];
        } else {
            //Crea un evento
            sql = `INSERT INTO event(eventId, type, date, name, description, goal, profileId, finalized, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
            // Genera profileId único
            const _eventId = await generateUniqueEventId();
            arr = [_eventId, type, date, name, description, goal, profileId, finalized, 1];
        }
                connection.con.query(sql, arr, (err, result, field) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        res.send({status: 1, data: result});
                    }
                })
    } catch (error) {
        res.send({status: 0, data: error});
    }
    connection.con.end;
});

//Obtiene el listado de eventos para el profileId pasado
router.post('/get-event-list', async function(req, res, next){
    try{
        let {profileId} = req.body;
        const sql = `SELECT  e.*, u.profileId, u.name AS userName, u.email, u.thumbnail
                     FROM event AS e 
                     INNER JOIN user AS u ON u.profileId = e.profileId
                     WHERE e.profileId = ? AND e.status = 1`;
        connection.con.query(sql, profileId, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    res.send({status: 1, data: result});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

//Obtiene el listadol de eventos para el profileId pasado
router.get('/get-event-top', async function(req, res, next){
    try{
        const sql = `
                    SELECT  e.*, u.profileId, u.name AS userName, u.email, u.thumbnail
                        FROM event AS e 
                        INNER JOIN user AS u ON u.profileId = e.profileId
                    WHERE DATE_SUB(e.finalized, INTERVAL 10 DAY) > NOW()
                        AND e.status = 1 
                    ORDER BY e.finalized DESC 
                    LIMIT 10
                    `;
        connection.con.query(sql, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    res.send({status: 1, data: result});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        // error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});


//MESSAGES

//Obtiene los mensajes de un evento en particular
router.post('/get-messages-event', async function(req, res, next) {
    try {
        let { eventId } = req.body;
        const sql = `
            SELECT m.*, u.name AS userName, u.email
            FROM message AS m
            LEFT JOIN user AS u ON u.profileId = m.profileId
            WHERE m.eventId = ?
        `;
        connection.con.query(sql, eventId, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length) {
                    res.send({status: 1, data: result});
                } else {
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch (error) {
        // error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

//Obtiene el total de los mensajes para ese evento
router.post('/count-messages-event', async function(req, res, next) {
    try {
        let { eventId } = req.body;
        const sql = `
            SELECT COUNT(*) AS total
            FROM message
            WHERE eventId = ?
        `;
        connection.con.query(sql, eventId, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length) {
                    res.send({status: 1, data: result});
                } else {
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch (error) {
        // error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

//Obtiene el total de los regalos para ese evento
router.post('/count-gifts-event', async function(req, res, next) {
    try {
        let { eventId } = req.body;
        const sql = `
            SELECT COUNT(*) AS total
            FROM gift
            WHERE eventId = ?
        `;
        connection.con.query(sql, eventId, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length) {
                    res.send({status: 1, data: result});
                } else {
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch (error) {
        // error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});


//GIFTS

//Obtiene los regalos hechos a un evento
router.post('/get-gift-event', async function(req, res, next) {
    try {
        let { eventId } = req.body;
        const sql = `
            SELECT g.*, u.name AS userName, u.email, u.thumbnail
            FROM gift AS g
            LEFT JOIN user AS u ON u.profileId = g.profileId
            WHERE g.eventId = ?
        `;
        connection.con.query(sql, eventId, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length) {
                    res.send({status: 1, data: result});
                } else {
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch (error) {
        // error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});


//NOTIFICATIONS

//Obtiene las notificaciones de un usuario asociados a un evento activo
router.post('/get-notifications', auth.verifyToken, async function(req, res, next) {
    try {
        let { profileId } = req.body;
        const sql = `
            SELECT n.* 
            FROM notification AS n
            INNER JOIN event as e ON e.eventId = n.eventId
            WHERE n.profileId = ? AND e.status = 1
        `;
        connection.con.query(sql, profileId, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length) {
                    res.send({status: 1, data: result});
                } else {
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch (error) {
        // error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});


// PAYMENTS

//Ruta que realiza el pago del cliente desde mercadopago y cobra comisiones
router.post('/transfer', async (req, res) => {
    const { amount, payerEmail, receiverEmail } = req.body;

    try {

        mercadopago.configure({
            access_token: 'APP_USR-3449148006386153-111112-92b44aa40cee1f65afc4f6ae7cde929f-2091998724'
        });
        // Configura el porcentaje de comisión para el host
        const feePercentage = 0.05; // 5% de comisión
        const feeAmount = amount * feePercentage;

        // Crear preferencia de pago para la transferencia
        const preference = {
            items: [
                {
                    title: 'Transferencia a través de la plataforma',
                    unit_price: parseFloat(amount.toFixed(2)),
                    quantity: 1,
                },
            ],
            payer: {
                email: payerEmail,
            },
            payment_methods: {
                excluded_payment_types: [{ id: 'ticket' }], // Excluye métodos de pago en efectivo
                installments: 1,
            },
            // Define la comisión de la plataforma
            marketplace_fee: parseFloat(feeAmount.toFixed(2)),
            external_reference: receiverEmail,
            notification_url: 'https://tu-dominio.com/webhook', // URL para recibir notificaciones de pago
        };

        // Crea la preferencia de pago en MercadoPago
        const response = await mercadopago.preferences.create(preference);
        
        // Devuelve el enlace de pago para iniciar la transferencia
        res.status(200).json({ init_point: response.body.init_point });

    } catch (error) {
        console.error('Error al crear la transferencia:', error);
        res.status(500).json({ error: 'Error al procesar la transferencia' });
    }
});

  
// Ruta para recibir notificaciones IPN
router.post('/api/notifications', (req, res) => {
    const paymentInfo = req.body;
    // Manejar el estado del pago y actualizarlo en la base de datos si es necesario
    console.log('Notificación de pago recibida:', paymentInfo);
    res.sendStatus(200);
});


module.exports = router;