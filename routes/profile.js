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

//Desbloquea la cuenta del usuario cundo se ingresa el código de activación asignado a dicha cuenta
router.post('/verificate-user', auth.verifyToken, async function(req, res, next){
    try{
        let {email, activation_code} = req.body;

        const checkCode = `SELECT * FROM users WHERE email = ? AND activation_code = ?`;
        connection.con.query(checkCode, [email, activation_code], (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    const activate = `UPDATE users SET state = 1 WHERE id = ?`;
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

//Verifica la contraseña del usuario
router.post('/verificate-password', auth.verifyToken, async function(req, res, next){
    try{
        let {id, password} = req.body;

        const hashed_password = md5(password.toString())
        const checkPassword = `SELECT * FROM users WHERE id = ? AND password = ?`;
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

//Actualiza el nombre de usuario
router.post('/update-username', auth.verifyToken, async function(req, res, next){
    try {
        let {id, name} = req.body;

        let changedRows;
        const sql = `UPDATE users SET name = ? WHERE id = ?`;
        connection.con.query(sql, [name, id], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                changedRows = result.changedRows
                const sql_data = `SELECT users.id, users.name, email, password, role, thumbnail, enterprise.name AS enterprise, activation_code, state FROM users INNER JOIN enterprise ON users.id_enterprise = enterprise.id WHERE users.id = ?`;
                connection.con.query(sql_data, id, (err, result, field) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        let user = [{id: result[0].id, name: result[0].name, email: result[0].email, password: result[0].password, role: result[0].role, thumbnail: result[0].thumbnail, enterprise: result[0].enterprise, activation_code: result[0].activation_code, state: result[0].state}]
                            //éxito al modificar usuario
                            let token = jwt.sign({data: user}, keys.key);
                            res.send({status: 1, data: user, token: token, changedRows: changedRows});
                    }
                })
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

//Actualiza la contraseña del usuario
router.post('/update-password', auth.verifyToken, async function(req, res, next){
    try {
        let {id, password} = req.body;

        const hashed_password = md5(password.toString())
        const sql = `UPDATE users SET password = ? WHERE id = ?`;
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

//Actualiza el correo electrónico del usuario
router.post('/update-email', auth.verifyToken, async function(req, res, next){
    try {
        let {id, email, activation_code, state} = req.body;

        const sql = `UPDATE users SET email = ?, activation_code = ?, state = ? WHERE id = ?`;
        connection.con.query(sql, [email, activation_code, state, id], (err, result, field) => {
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

//Carga una nueva imagen de usuario
router.post('/load-image', auth.verifyToken, async (req, res, next) => {
    try {
        let {id, enterprise, name, thumbnail, blanck} = req.body;
        let changedRows;

        if(thumbnail.includes(';base64,')){
            await save_image(id, enterprise, name, thumbnail, blanck)
            .then( value => {
                if(value == 'error') throw 'error';
                else {
                    thumbnail = value;
                }
            } )
            .catch( error => {
                throw error;
            } )
        }
        const sql_data = `SELECT users.id, users.name, email, password, role, thumbnail, enterprise.name AS enterprise, activation_code, state FROM users INNER JOIN enterprise ON users.id_enterprise = enterprise.id WHERE users.id = ?`;
        connection.con.query(sql_data, id, (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                let user = [{id: result[0].id, name: result[0].name, email: result[0].email, password: result[0].password, role: result[0].role, thumbnail: thumbnail, enterprise: result[0].enterprise, activation_code: result[0].activation_code, state: result[0].state}]
                let token = jwt.sign({data: user}, keys.key);
                    if(blanck) {
                        const sql = `UPDATE users SET thumbnail = ? WHERE id = ?`;
                        connection.con.query(sql, [thumbnail, id], (err, result, field) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                changedRows = result.changedRows
                                res.send({status: 1, data: user, token: token, changedRows: changedRows});
                            }
                        })
                    } else {
                        changedRows = 1
                        res.send({status: 1, data: user, token: token, changedRows: changedRows});
                    }
            }
        })
    } catch (error) {
        res.send({status: 0, data: error});
    }
    connection.con.end;
});

module.exports = router;