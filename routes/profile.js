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


/* ----------------------- POST --------------------------*/

// Desbloquea la cuenta del usuario cundo se ingresa el código de activación asignado a dicha cuenta
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

// Verifica la contraseña del usuario
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

// Actualiza el nombre de usuario
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
                const sql_data = `SELECT u.id, u.name, u.email, u.password, u.thumbnail, e.name AS enterprise, u.activation_code, u.state FROM users AS u INNER JOIN enterprise AS e ON u.id_enterprise = e.id WHERE u.id = ?`;
                connection.con.query(sql_data, id, (err, result, field) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        let user = [{id: result[0].id, name: result[0].name, email: result[0].email, password: result[0].password, thumbnail: result[0].thumbnail, enterprise: result[0].enterprise, activation_code: result[0].activation_code, state: result[0].state}]
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

// Actualiza la contraseña del usuario
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

// Actualiza el correo electrónico del usuario
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

// Carga una nueva imagen de usuario
router.post('/load-user-image', auth.verifyToken, async (req, res, next) => {
    try {
        let {id, thumbnail, blanck} = req.body;
        let changedRows;

        if(thumbnail.includes(';base64,')){
            await save_image(id, 'user', 'thumbnail', thumbnail, 350, 350, blanck)
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
        const sql_data = `SELECT u.id, u.name, u.email, u.password, u.thumbnail, e.name AS enterprise, u.activation_code, u.state FROM users AS u INNER JOIN enterprise AS e ON u.id_enterprise = e.id WHERE u.id = ?`;
        connection.con.query(sql_data, id, (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                let user = [{id: result[0].id, name: result[0].name, email: result[0].email, password: result[0].password, thumbnail: thumbnail, enterprise: result[0].enterprise, activation_code: result[0].activation_code, state: result[0].state}]
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

// Carga un nuevo logo para la empresa
router.post('/load-logo-image', auth.verifyToken, async (req, res, next) => {
    try {
        let {id, thumbnail, blanck} = req.body;
        let changedRows;

        if(thumbnail.includes(';base64,')){
            await save_image(id, 'enterprise', 'thumbnail', thumbnail, 350, 350, blanck)
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

        if(blanck) {
            const sql = `UPDATE enterprise SET thumbnail = ? WHERE id = ?`;
            connection.con.query(sql, [thumbnail, id], (err, result, field) => {
                if (err) {
                    res.send({status: 0, data: err});
                } else {
                    changedRows = result.changedRows
                    res.send({status: 1, changedRows: changedRows});
                }
            })
        } else {
            changedRows = 1
            res.send({status: 1, changedRows: changedRows});
        }
    } catch (error) {
        res.send({status: 0, data: error});
    }
    connection.con.end;
});

// Actualiza los valores de la empresa
router.post('/update-enterprise', auth.verifyToken, async function(req, res, next){
    try {
        let {id, name, cuit, address, cp, phone_1, phone_2, city, state, country } = req.body;

        const sql = `UPDATE enterprise SET name = ?, address= ?, phone_1 = ?, phone_2 = ?, cp = ?, country = ?, state = ?, city = ?, cuit = ? WHERE id = ?`;
        connection.con.query(sql, [name, address, phone_1, phone_2, cp, country, state, city, cuit, id], (err, result, field) => {
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

// Actualiza los valores de un empleado (personal)
router.post('/update-employee-personal', auth.verifyToken, async function(req, res, next){
    try {
        let {id_user, name, email, address, date, phone, mobile } = req.body;
        const _sql = `UPDATE employee SET name = ?, email = ?, address= ?, date = ?, phone = ?, mobile = ? WHERE id_user = ?`;
        const _arr = [name, email, address, date, phone, mobile, id_user];
        let changedRows;

            connection.con.query(_sql, _arr, (err, result, field) => {
                if (err) {
                    res.send({status: 0, data: err});
                } else {
                    changedRows = result.changedRows
                    const sql_data = `SELECT * FROM employee WHERE id_user = ?`;
                        connection.con.query(sql_data, id_user, (err, result, field) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                    //éxito al modificar y recargar datos empleado
                                    res.send({status: 1, data: result, changedRows: changedRows});
                            }
                        })
                }
            })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza los valores de un empleado (laboral)
router.post('/update-employee-work', auth.verifyToken, async function(req, res, next){
    try {
        let { id_user, name_er, phone_er } = req.body.data;
        let _sql = '';
        let _arr = [];
        let changedRows;

        if(req.body.work_hour){
            let work_hour = JSON.stringify(req.body.work_hour)
            _sql = `UPDATE employee SET name_er = ?, phone_er = ?, working_hours = ? WHERE id_user = ?`;
            _arr = [name_er, phone_er, work_hour, id_user];
        } else {
            _sql = `UPDATE employee SET name_er = ?, phone_er = ? WHERE id_user = ?`;
            _arr = [name_er, phone_er, id_user];
        }
        connection.con.query(_sql, _arr, (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                changedRows = result.changedRows
                    const sql_data = `SELECT * FROM employee WHERE id_user = ?`;
                        connection.con.query(sql_data, id_user, (err, result, field) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                    //éxito al modificar y recargar datos empleado
                                    res.send({status: 1, data: result, changedRows: changedRows});
                            }
                        })
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza los permisos de un rol
router.post('/update-role-permissions', auth.verifyToken, async function(req, res, next){
    try {
        let {id, icon_role, name_role, list_of_permissions} = req.body;

        const _sql = `UPDATE role SET name_role= ?, icon_role= ?, list_of_permissions= ? WHERE id = ?`;
        connection.con.query(_sql, [name_role, icon_role, list_of_permissions, id], (err, result, field) => {
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


/* ----------------------- GET --------------------------*/

// Devuelve una empresa del listado
router.post('/get-enterprise', auth.verifyToken, async function(req, res, next){
    try{
        let {id} = req.body;
        const sql = `SELECT * FROM enterprise WHERE id = ?`;
        connection.con.query(sql, id, (err, result, fields) => {
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

// Devuelve una lista de usuarios de una empresa en particular
router.post('/get-employees', auth.verifyToken, async function(req, res, next){
    try{
        let {id_enterprise} = req.body;
        const sql = `SELECT U.id, U.email, U.state AS verify, (SELECT COUNT(*) FROM employee AS E WHERE E.id_user = U.id) AS "is_employee" FROM users AS U WHERE U.id_enterprise = ?`;
        connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

// Devuelve un empleado del listado
router.post('/get-employee', auth.verifyToken, async function(req, res, next){
    try{
        let {id_user} = req.body;
        const sql = `SELECT e.id, e.id_user, e.id_enterprise, e.name, e.email, e.address, e.date, e.phone, e.mobile, e.working_hours, e.name_er, e.phone_er, e.state, r.name_role, r.list_of_permissions 
                    FROM employee AS e INNER JOIN role AS r ON e.role = r.id 
                    WHERE id_user = ?`;
        connection.con.query(sql, id_user, (err, result, fields) => {
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


    // Facturación

        // Devuelve el número total de facturas por id para paginador
        router.post('/get-count-bills', auth.verifyToken, async function(req, res, next){
            try{
                let {id} = req.body;
                const sql = `SELECT COUNT(*) as total FROM bills WHERE id_enterprise = ?`;
                connection.con.query(sql, id, (err, result, fields) => {
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

        // Devuelve una lista de facturas de la empresa en cuestión
        router.post('/get-bills', auth.verifyToken, async function(req, res, next){
            try{
                let {id, page, size} = req.body;
                const sql = `SELECT * FROM bills WHERE id_enterprise = ? LIMIT ? OFFSET ?`;
                connection.con.query(sql, [id, size, size*page], (err, result, fields) => {
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

    // -----------------------------------


    // Productos

        // Devuelve datos específicos de la tabla productos
        router.post('/get-products-data', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise, date_limit} = req.body;
                const sql = `SELECT *
                            FROM (
                                SELECT CAST(COUNT(p.id) AS CHAR) as data FROM product as p WHERE p.is_stock = 'con stock' AND p.id_enterprise = ?
                                UNION
                                SELECT FORMAT(SUM(p.sale_price), 2) FROM product as p WHERE p.is_stock = 'con stock' AND p.id_enterprise = ?
                                UNION
                                SELECT CAST(COUNT(p.id) AS CHAR) FROM product as p WHERE p.sale_date > ? AND p.is_stock = 'sin stock' AND p.id_enterprise = ?
                                UNION
                                SELECT FORMAT(SUM(p.sale_price), 2) FROM product as p WHERE p.sale_date < ? AND p.is_stock = 'con stock' AND p.id_enterprise = ?
                            ) AS results`;
                connection.con.query(sql, [id_enterprise, id_enterprise, date_limit, id_enterprise, date_limit, id_enterprise], (err, result, fields) => {
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

        //Categorías
            // Devuelve el listado de las categorías
            router.post('/get-categories', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT * FROM categories WHERE id_enterprise = ?`;
                    connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

            // Devuelve una categoría por ID
            router.post('/get-category-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_category} = req.body;
                    const sql = `SELECT * FROM categories WHERE id = ?`;
                    connection.con.query(sql, id_category, (err, result, fields) => {
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

            // Devuelve el listado de las categorías con stock y precio del total de cada categoría
            router.post('/get-categories-stock-price', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT c.*,
                                COALESCE(SUM(p.stock_real), 0) AS total_stock_real,
                                COALESCE(SUM(CASE WHEN p.stock_real > 0 THEN p.sale_price ELSE 0 END), 0) AS total_sale_price 
                                FROM categories AS c 
                                LEFT JOIN product AS p ON c.id = p.category 
                                WHERE c.id_enterprise = ? 
                                GROUP BY c.id
                                ORDER BY c.name`;
                    connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

            // Crea una categoría nueva
            router.post('/create-category', auth.verifyToken, async function(req, res, next){
                try{
                    let {id, id_enterprise, name, color_badge, color} = req.body;
                    const sql_e = `SELECT name FROM categories WHERE name = ?;`
                    connection.con.query(sql_e, name, (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            if (!result.length) {
                                //éxito en no encontrar esta categoría
                                const sql = `INSERT INTO categories(id_enterprise, name, color_badge) VALUES (?, ?, ?)`;
                                connection.con.query(sql, [id_enterprise, name, color_badge], (err, response, fields) => {
                                    if (err) {
                                        //error de conexion o para crear la categoría
                                        res.send({status: 0, data: err});
                                    } else {
                                        res.send({status: 1, data: response})
                                    }
                                })
                            } else{
                                //error porque existe usuario
                                res.send({status: 1, data: 'existente'});
                            }
                        }
                    });
                } catch(error){
                    //error de conexión
                    res.send({status: 0, error: error});
                }
                connection.con.end;
            });

            // Edita una categoría
            router.post('/edit-category', auth.verifyToken, async function(req, res, next){
                try{
                    let {id, id_enterprise, name, color_badge, color} = req.body;
                    const sql = `UPDATE categories AS c
                                SET name=?,color_badge=?
                                WHERE c.id = ?`;
                    connection.con.query(sql, [name, color_badge, id], (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            res.send({status: 1, data: result})
                        }
                    });
                } catch(error){
                    //error de conexión
                    res.send({status: 0, error: error});
                }
                connection.con.end;
            });

        // Devuelve el listado de las opciones 1 (Color)
        router.post('/get-option1', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT * FROM table_option_1 WHERE id_enterprise = ?`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

        // Devuelve el listado de las opciones 2 (Medida)
        router.post('/get-option2', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT * FROM table_option_2 WHERE id_enterprise = ?`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

        // Devuelve el listado de las ubicaciones
        router.post('/get-storages', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT * FROM storage WHERE id_enterprise = ?`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

        // Devuelve el listado de las proveedores
        router.post('/get-providers', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT * FROM provider WHERE id_enterprise = ?`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

        // Devuelve el número total de productos por id_enterprise para paginador
        router.post('/get-count-products', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT COUNT(*) as total FROM product WHERE id_enterprise = ?`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

        // Devuelve una lista de productos de la empresa(id_enterprise)
        router.post('/get-products', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise, page, size} = req.body;
                const sql = `SELECT p.*, c.name AS category_item, c.color_badge AS category_color 
                            FROM product AS p INNER JOIN categories AS c ON p.category = c.id 
                            WHERE p.id_enterprise = ?
                            LIMIT ? 
                            OFFSET ?`;
                connection.con.query(sql, [id_enterprise, size, size*page], (err, result, fields) => {
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

        // Devuelve una lista de productos de la empresa para crear uno nuevo(id_enterprise)
        router.post('/get-products-listOfName', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT p.name, p.category 
                            FROM product AS p 
                            WHERE p.id_enterprise = ?
                            ORDER BY p.name`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

        // Devuelve un producto por id_enterprise, name, id_option_1, id_option_2
        router.post('/get-product-detail', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise, name, id_option_1, id_option_2} = req.body;
                const sql = `SELECT p.*, c.name AS category_item, c.color_badge AS category_color , s.name AS storage_name, prov.name AS provider_name, t1.name AS option_1_name, t2.name AS option_2_name 
                            FROM product AS p INNER JOIN categories AS c ON p.category = c.id 
                            INNER JOIN storage AS s ON p.storage_location = s.id 
                            INNER JOIN provider AS prov ON p.provider = prov.id
                            INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id 
                            INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id  
                            WHERE p.id_enterprise = ? AND p.name = ? AND p.id_option_1 = ? AND p.id_option_2 = ?`;
                connection.con.query(sql, [id_enterprise, name, id_option_1, id_option_2], (err, result, fields) => {
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

        // Devuelve las variantes de opciones del mismo producto
        router.post('/get-product-variants', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise, name} = req.body;
                const sql = `SELECT p.*,  t1.name AS option_1_name, t2.name AS option_2_name
                            FROM product AS p 
                            INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id 
                            INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id 
                            WHERE p.id_enterprise = ? AND p.name = ?`;
                connection.con.query(sql, [id_enterprise, name], (err, result, fields) => {
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

        // Devuelve un producto por ID solamente
        router.post('/get-product-detail-by-id', auth.verifyToken, async function(req, res, next){
            try{
                let {id_product} = req.body;
                const sql = `SELECT p.*, c.name AS category_item, c.color_badge AS category_color , s.name AS storage_name, prov.name AS provider_name 
                            FROM product AS p INNER JOIN categories AS c ON p.category = c.id 
                            INNER JOIN storage AS s ON p.storage_location = s.id 
                            INNER JOIN provider AS prov ON p.provider = prov.id 
                            WHERE p.id = ?`;
                connection.con.query(sql, id_product, (err, result, fields) => {
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

        // Devuelve la cantidad de un mismo producto pero para diferentes valores del campo "id_option_1" (DEPRECATED en product-detail)
        router.post('/get-product-detail-option1', auth.verifyToken, async function(req, res, next){
            try{
                let {name, id_enterprise} = req.body;
                const sql = `SELECT p.id_option_1 AS id_option, t1.name AS option, SUM(p.stock_real) AS stock 
                            FROM product AS p 
                            INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id 
                            WHERE p.name = ? AND p.id_enterprise = ? 
                            GROUP BY p.id_option_1 
                            HAVING COUNT(DISTINCT p.id_option_1) > 0;`;
                connection.con.query(sql, [name, id_enterprise], (err, result, fields) => {
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

        // Devuelve la cantidad de un mismo producto pero para diferentes valores del campo "id_option_2" (DEPRECATED en product-detail)
        router.post('/get-product-detail-option2', auth.verifyToken, async function(req, res, next){
            try{
                let {name, id_enterprise} = req.body;
                const sql = `SELECT p.id_option_2 AS id_option, t2.name AS option, SUM(p.stock_real) AS stock 
                            FROM product AS p 
                            INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id 
                            WHERE p.name = ? AND p.id_enterprise = ? 
                            GROUP BY p.id_option_2 
                            HAVING COUNT(DISTINCT p.id_option_2) > 0;`;
                connection.con.query(sql, [name, id_enterprise], (err, result, fields) => {
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

        // Verifica si un SKU existe
        router.post('/test-sku', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise, sku} = req.body;
                const sql = `SELECT * FROM product AS p WHERE p.id_enterprise = ? AND p.sku = ?`;
                connection.con.query(sql, [id_enterprise, sku], (err, result, fields) => {
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

        //Editar campos de un producto
            //Crea un producto nuevo pero solo la parte de información básica de producto
            router.post('/create-product', auth.verifyToken, async function(req, res, next){
                try {
                    let {id_enterprise, name, description, category, id_option_1, id_option_2, sku } = req.body;

                    const sql = `INSERT INTO product(id_enterprise, image, name, description, category, id_option_1, id_option_2, sku, stock_real, is_stock, stock_available, storage_location, sale_price, purchase_price, provider, purchase_date, sale_date, state) 
                                VALUES (?,'no-image.png',?,?,?,?,?,?,0 ,'sin stock',0,1,0.00,0.00,1,'','','inactivo')`;
                    connection.con.query(sql, [id_enterprise, name, description, category, id_option_1, id_option_2, sku], (err, result, field) => {
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

            //Edita un producto, pero los campos de información básica
            router.post('/edit-product-information', auth.verifyToken, async function(req, res, next){
                try {
                    let {name, description, category, id_option_1, id_option_2, sku, id, id_enterprise} = req.body;

                    const sql = `UPDATE product AS p 
                                SET name=?,description=?,category=?,id_option_1=?,id_option_2=?,sku=? WHERE p.id = ?`;
                    connection.con.query(sql, [name, description, category, id_option_1, id_option_2, sku, id], (err, result, field) => {
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

            // Edita una imagen para un producto por ID
            router.post('/edit-product-image', auth.verifyToken, async (req, res, next) => {
                try {
                    let {id, image, blanck} = req.body;
                    let changedRows;

                    if(image.includes(';base64,')){
                        await save_image(id, 'product', 'picture', image, 600, 600, blanck)
                        .then( value => {
                            if(value == 'error') throw 'error';
                            else {
                                image = value;
                            }
                        } )
                        .catch( error => {
                            throw error;
                        } )
                    }

                    if(blanck) {
                        const sql = `UPDATE product SET image = ? WHERE id = ?`;
                        connection.con.query(sql, [image, id], (err, result, field) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                changedRows = result.changedRows
                                res.send({status: 1, changedRows: changedRows});
                            }
                        })
                    } else {
                        changedRows = 1
                        res.send({status: 1, changedRows: changedRows});
                    }
                } catch (error) {
                    res.send({status: 0, data: error});
                }
                connection.con.end;
            });

            //Edita un producto, pero los campos de proveedor, fehca de compra y precio de compra
            router.post('/edit-product-provider', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, provider, purchase_date, purchase_price} = req.body;

                    const sql = `UPDATE product AS p 
                                SET provider=?, purchase_date=?, purchase_price=? WHERE p.id = ?`;
                    connection.con.query(sql, [provider, purchase_date, purchase_price, id], (err, result, field) => {
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

            //Edita un producto, pero los campos de stock_real, stock_available y is_stock
            router.post('/edit-product-stock', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, stock_real, is_stock, stock_available} = req.body;

                    const sql = `UPDATE product AS p 
                                SET stock_real=?, is_stock=?, stock_available=? WHERE p.id = ?`;
                    connection.con.query(sql, [stock_real, is_stock, stock_available, id], (err, result, field) => {
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

            //Edita un producto, pero el campo de sale_price
            router.post('/edit-product-price', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, sale_price, purchase_price} = req.body;

                    const sql = `UPDATE product AS p 
                                SET sale_price=? WHERE p.id = ?`;
                    connection.con.query(sql, [sale_price, id], (err, result, field) => {
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

            //Edita un producto, pero el campo de storage_location
            router.post('/edit-product-storage', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, storage_location} = req.body;

                    const sql = `UPDATE product AS p 
                                SET storage_location=? WHERE p.id = ?`;
                    connection.con.query(sql, [storage_location, id], (err, result, field) => {
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

            //Activa o desactiva un producto
            router.post('/edit-product-activation', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, state} = req.body;

                    const sql = `UPDATE product AS p 
                                SET state=? WHERE p.id = ?`;
                    connection.con.query(sql, [state, id], (err, result, field) => {
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

    // -----------------------------------


    // Roles

        // Devuelve el número total de usuarios por id para paginador
        router.post('/get-count-users', auth.verifyToken, async function(req, res, next){
            try{
                let {id} = req.body;
                const sql = `SELECT COUNT(*) as total FROM users WHERE id_enterprise = ?`;
                connection.con.query(sql, id, (err, result, fields) => {
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

        // Devuelve los roles de cada empresa
        router.post('/get-enterprise-roles', auth.verifyToken, async function(req, res, next){
            try {
                let {id_enterprise} = req.body;
                const _sql = `SELECT * FROM role WHERE id_enterprise = ?`;
                connection.con.query(_sql, id_enterprise, (err, result, fields) => {
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
            } catch (error) {
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Devuelve una lista de usuarios de la empresa en cuestión
        router.post('/get-enterprise-users', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT u.email, u.thumbnail, u.state AS verified_state,
                            (SELECT e.id FROM employee AS e WHERE e.id_user = u.id) AS id_employee, 
                            (SELECT e.name FROM employee AS e WHERE e.id_user = u.id) AS name_employee, 
                            (SELECT r.name_role FROM employee AS e INNER JOIN role AS r ON e.role = r.id WHERE e.id_user = u.id) AS role, 
                            (SELECT e.state FROM employee AS e WHERE e.id_user = u.id) AS state_employee 
                            FROM users AS u 
                            WHERE u.id_enterprise = ?`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
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

        //Devuelve el listado de permisos de la tabla permissions
        router.get('/get-permissions', async function(req, res, next){
            try{
                const _sql = `SELECT * FROM permissions`;
                connection.con.query(_sql, (err, result, fields) => {
                    if(err){
                        res.send({status: 0, data: err});
                    } else{
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

        // Devuelve los permisos de un rol en particular, utilizando el id de ese rol de esa empresa
        router.post('/get-role-permissions', auth.verifyToken, async function(req, res, next){
            try {
                let {id_role} = req.body;
                const _sql = `SELECT * FROM role WHERE id = ?`;
                connection.con.query(_sql, id_role, (err, result, fields) => {
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
            } catch (error) {
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Crear un nuevo rol para una empresa
        router.post('/create-new-role', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise, name_role, icon_role} = req.body;
                const sql = `INSERT INTO role(id_enterprise, name_role, icon_role) VALUES (?, ?, ?)`;
                connection.con.query(sql, [id_enterprise, name_role, icon_role], (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        res.send({status: 1, data: result});
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Elimina un rol de una empresa
        router.post('/delete-role', auth.verifyToken, async function(req, res, next){
            try{
                let {id} = req.body;
                const sql = `DELETE FROM role WHERE id = ?`;
                connection.con.query(sql, id, (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        res.send({status: 1, data: result});
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

    // -----------------------------------

module.exports = router;