const express = require('express');
const router  = express.Router();
const app = express();
const keys = require('../settings/keys');
const cors = require('cors');
const bodyParser = require('body-parser');
const configmensaje = require('./configmensaje');
const connection = require('../settings/connection');
const nodemailer = require('nodemailer');
const jConfig = require('../settings/emailConfig');

app.use(bodyParser.json());
app.use(cors());

const md5     = require('md5');
const jwt     = require('jsonwebtoken');
const { restart } = require('nodemon');
const generateNumber = require('../functions/generateNumber');

//Registra un usuario nuevo
router.post('/register', async (req, res) => {
    try {
        let { email, password, thumbnail, activationCode } = req.body;

        // Función para generar el profileId y verificar que no exista duplicado
        const generateUniqueprofileId = async () => {
            let profileId;
            let exists = true;
            while (exists) {
                profileId = generateNumber(20); // Genera código alfanumérico de 20 caracteres
                exists = await checkIfprofileIdExists(profileId);
            }
            return profileId;
        };

        // Función para verificar si el profileId existe en la base de datos
        const checkIfprofileIdExists = (profileId) => {
            return new Promise((resolve, reject) => {
                const checkprofileIdQuery = `SELECT profileId FROM user WHERE profileId = ?`;
                connection.con.query(checkprofileIdQuery, [profileId], (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result.length > 0); // Si existe un duplicado, devuelve true
                });
            });
        };

        // Función para verificar si el email ya está registrado
        const checkIfEmailExists = (email) => {
            return new Promise((resolve, reject) => {
                const checkEmailQuery = `SELECT email FROM user WHERE email = ?`;
                connection.con.query(checkEmailQuery, [email], (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result.length > 0); // Si el email ya existe, devuelve true
                });
            });
        };

        // Función para insertar el nuevo usuario
        const insertNewUser = (email, hashed_password, profileId, thumbnail, activationCode) => {
            return new Promise((resolve, reject) => {
                const insertUserQuery = `
                    INSERT INTO user (email, password, profileId, thumbnail, activationCode, created)
                    VALUES (?, ?, ?, ?, ?, NOW())
                `;
                connection.con.query(insertUserQuery, [email, hashed_password, profileId, thumbnail, activationCode], (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        };

        // Genera profileId único
        const profileId = await generateUniqueprofileId();

        // Encripta la contraseña
        const hashed_password = md5(password.toString());

        // Verifica si el email ya existe
        const emailExists = await checkIfEmailExists(email);

        if (emailExists) {
            // Error porque el email ya existe
            return res.send({ status: 1, data: 'existente' });
        }

        // Inserta el nuevo usuario
        const insertResult = await insertNewUser(email, hashed_password, profileId, thumbnail, activationCode);

        // Usuario agregado con éxito
        let user = [{
            id: insertResult.insertId,
            email: email,
            password: hashed_password,
            profileId: profileId,
            thumbnail: thumbnail,
            status: 0
        }];

        // Genera token JWT
        let token = jwt.sign({ data: user }, keys.key);
        res.send({ status: 1, data: user, token: token });

    } catch (error) {
        // Error de conexión o ejecución
        res.send({ status: 0, error: error });
    } finally {
        connection.con.end(); // Asegúrate de cerrar la conexión
    }
});

//Comprueba las credenciales de usuario y dá acceso
router.post('/login', async function(req, res, next){
    try {
        let {email, password} = req.body;
        const hashed_password = md5(password.toString())
        const sql = `SELECT 
                        u.id,
                        u.email,
                        u.profileId,
                        u.thumbnail,
                        u.name,
                        u.status 
                    FROM user AS u
                    WHERE u.email = ? AND u.password = ?`
        connection.con.query(sql, [email, hashed_password], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    let token = jwt.sign({data: result}, keys.key);
                    res.send({status: 1, data: result, token: token});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

//Comprueba las credenciales de usuario y dá acceso
router.post('/recharge', async function(req, res, next){
    try {
        let {email, profileId} = req.body;
        const sql = `SELECT 
                        u.id,
                        u.email,
                        u.profileId,
                        u.thumbnail,
                        u.name,
                        u.status 
                    FROM user AS u
                    WHERE u.email = ? AND u.profileId = ?`
        connection.con.query(sql, [email, profileId], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    let token = jwt.sign({data: result}, keys.key);
                    res.send({status: 1, data: result, token: token});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

//Verifica que el correo electrónico pertenezca a una cuenta y devuelve su información
router.post('/verificate-email', async function(req, res, next){
    try{
        let {email} = req.body;

        const checkEmail = `SELECT * FROM user WHERE email = ?`;
        connection.con.query(checkEmail, email, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if (result.length) {
                    //Se encontró el correo electrónico
                    res.send({status: 1, data: result});
                } else{
                    //No encontró el correo electrónico
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, data: error});
    }
    connection.con.end;
});

//Activa la cuenta bloqueada por código de activación
router.post('/verificate-code', async function(req, res, next){
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

//Envio de email
router.post('/envio-email', async function(req, res){
    try {
        configmensaje.email_body.to = req.body.email;
        configmensaje.data = req.body.data;
        switch (req.body.tipo) {
            case 'register':
                configmensaje.email_body.subject = 'Bienvenido a Bamboo!';
                configmensaje.email_body.html = configmensaje.body.html_initial + configmensaje.email_body.subject + configmensaje.body.html_middle + configmensaje.plantilla_register.pr1 + configmensaje.data + configmensaje.plantilla_register.pr2 + configmensaje.body.html_final;
                break;
            case 'code':
                configmensaje.email_body.subject = 'Código de verificación';
                configmensaje.email_body.html = configmensaje.body.html_initial + configmensaje.email_body.subject + configmensaje.body.html_middle + configmensaje.plantilla_code.pc1 + configmensaje.data + configmensaje.plantilla_code.pc2 + configmensaje.body.html_final;
                break;
            case 'change_pass':
                configmensaje.email_body.subject = 'Actualización de tu cuenta';
                configmensaje.email_body.html = configmensaje.body.html_initial + configmensaje.email_body.subject + configmensaje.body.html_middle + configmensaje.plantilla_change_pass + configmensaje.body.html_final;
                break;
            case 'change_mail':
                configmensaje.email_body.subject = 'Actualización de tu cuenta';
                configmensaje.email_body.html = configmensaje.body.html_initial + configmensaje.email_body.subject + configmensaje.body.html_middle + configmensaje.plantilla_change_mail.pcm1 + configmensaje.data + configmensaje.plantilla_change_mail.pcm2 + configmensaje.body.html_final;
                break;
            case 'change_user':
                configmensaje.email_body.subject = 'Actualización de tu cuenta';
                configmensaje.email_body.html = configmensaje.body.html_initial + configmensaje.email_body.subject + configmensaje.body.html_middle + configmensaje.plantilla_change_user + configmensaje.body.html_final;
                break;
            /*case 'message':
                configmensaje.email_body.subject = 'Mensaje de usuario';
                configmensaje.title = 'Mensaje de usuario';
                configmensaje.body = configmensaje.plantilla_message;
                break;*/
        }
        let transport = nodemailer.createTransport(jConfig);

        transport.sendMail(configmensaje.email_body, function (error, info) {
            (error)?res.send({status: 1, data: 'nok'}):res.send({status: 1, data: 'ok'});
            transport.close();
        });
    } catch (error) {
        //error de conexión
        res.send({status: 0, data: error});
    }
    connection.con.end;
})

//Actualiza la contraseña del usuario
router.put('/restore-password', async function(req, res, next){
    try {
        let {email, id, password} = req.body;

        const hashed_password = md5(password.toString())
        const sql = `UPDATE user SET password = ? WHERE id = ?`;
        connection.con.query(sql, [hashed_password, id, email], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                res.send({status: 1, data: result});
            }
        })
    } catch (error) {
        console.log(error)
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

module.exports = router;