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

/* ----------------------- POST --------------------------*/

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
router.post('/get-profile-id', auth.verifyToken, async function(req, res, next){
    try{
        let {profileId} = req.body;
        const sql = `SELECT u.email, u.profileId, u.thumbnail, u.name, u.location, u.followers 
                     FROM user AS u 
                     WHERE profileId = ?`;
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


/* ----------------------- OBSOLETAS --------------------------*/

                // Carga una nueva imagen de usuario
                router.post('/update-user-image', auth.verifyToken, async (req, res, next) => {
                    try {
                        let {id, id_enterprise, thumbnail, prev_thumb} = req.body;
                        let changedRows;

                        if(thumbnail.includes(';base64,')){
                            await save_image(id_enterprise, id, 'user', 'thumbnail', thumbnail, 350, 350, prev_thumb)
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
                        const sql_data = `SELECT u.*, e.name AS enterprise, e.thumbnail AS enterprise_thumbnail
                                            FROM users AS u 
                                            INNER JOIN enterprise AS e ON u.id_enterprise = e.id 
                                            WHERE u.id = ?`;
                        connection.con.query(sql_data, id, (err, result, field) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                let user = [{id: result[0].id, name: result[0].name, email: result[0].email, password: result[0].password, thumbnail: thumbnail, id_enterprise: result[0].id_enterprise, enterprise: result[0].enterprise, enterprise_thumbnail: result[0].enterprise_thumbnail, activation_code: result[0].activation_code, state: result[0].state}]
                                let token = jwt.sign({data: user}, keys.key);
                                if(prev_thumb !== thumbnail) {
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

            //Editar campos de un producto
                //Crea un producto nuevo pero solo la parte de información básica de producto
                router.post('/create-product', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id_enterprise, name, description, category, sku } = req.body;

                        const sql = `INSERT INTO product(
                                        id_enterprise,
                                        image,
                                        name,
                                        description,
                                        category,
                                        sku,
                                        stock_real,
                                        stock_available,
                                        storage_location,
                                        sale_price,
                                        purchase_price,
                                        provider,
                                        purchase_date,
                                        sale_date,
                                        state) 
                                    VALUES (
                                        ?,
                                        'no-image.png',
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        0,
                                        0,
                                        1,
                                        0,
                                        0,
                                        1,
                                        '',
                                        '',
                                        'inactivo')`;
                        connection.con.query(sql, [id_enterprise, name, description, category, sku], (err, result, field) => {
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
                        let {name, description, category, sku, id, id_enterprise} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET name=?,description=?,category=?,sku=? WHERE p.id = ?`;
                        connection.con.query(sql, [name, description, category, sku, id], (err, result, field) => {
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
                        let {id, id_enterprise, image, prev_thumb} = req.body;
                        let changedRows;

                        if(image.includes(';base64,')){
                            await save_image(id_enterprise, id, 'product', 'picture', image, 600, 600, prev_thumb)
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

                        if(prev_thumb !== image) {
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
                                    SET provider=?, purchase_date=?, sale_price=?, purchase_price=? WHERE p.id = ?`;
                        connection.con.query(sql, [provider, purchase_date, purchase_price, purchase_price, id], (err, result, field) => {
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

                //Edita un producto, pero los campos de stock_real, stock_available
                router.post('/edit-product-stock', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, increment} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET stock_real = stock_real + ?, stock_available = stock_available + ?, purchase_date=NOW() 
                                    WHERE p.id = ?`;
                        connection.con.query(sql, [increment, increment, id], (err, result, field) => {
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

                //Edita un producto, pero solo el campo filters para filtros adicionales
                router.post('/edit-product-filters', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, filters} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET filters=? WHERE p.id = ?`;
                        connection.con.query(sql, [filters.join(','), id], (err, result, field) => {
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

                //Importar productos desde un archivo externo
                router.post('/import-product', auth.verifyToken, async function(req, res, next) {
                    let { id_enterprise, products } = req.body; // Obtenemos los datos del cuerpo de la solicitud
                    let add = 0;
                    let updated = 0;
                
                    // Función para importar productos con manejo de transacción
                    async function importProducts(conect, id_enterprise, products) {
                        try {
                            // Iniciar la transacción
                            await conect.beginTransaction();
                
                            // Iterar sobre cada producto
                            for (const product of products) {
                                const { name, description, sku, category, stock_real, sale_price } = product;
                
                                // Verificar si el producto ya existe
                                const [rows] = await new Promise((resolve, reject) => {
                                    conect.query(
                                        'SELECT sku, stock_real, stock_available FROM product WHERE sku = ? AND id_enterprise = ?',
                                        [sku, id_enterprise],
                                        (error, results) => {
                                            if (error) return reject(error);
                                            resolve(results);
                                        }
                                    );
                                });
                
                                // Manejar el caso en que `rows` devuelva un solo objeto
                                const result = Array.isArray(rows) ? rows : [rows];
                
                                if (rows != undefined && result.length > 0 && result[0].sku) {
                                    // Si el producto ya existe, actualizar el stock
                                    const currentStockReal = result[0].stock_real;
                                    const currentStockAvailable = result[0].stock_available;
                
                                    await new Promise((resolve, reject) => {
                                        conect.query(
                                            `UPDATE product 
                                             SET stock_real = ?, stock_available = ? 
                                             WHERE sku = ? AND id_enterprise = ?`,
                                            [currentStockReal + stock_real, currentStockAvailable + stock_real, sku, id_enterprise],
                                            (error, results) => {
                                                if (error) return reject(error);
                                                updated++;
                                                resolve(results);
                                            }
                                        );
                                    });
                                } else {
                                    // Si no existe, insertar el nuevo producto
                                    await new Promise((resolve, reject) => {
                                        conect.query(
                                            `INSERT INTO product (
                                                id_enterprise, image, name, description, category, filters, sku, stock_real, stock_available, storage_location, sale_price, purchase_price, provider, purchase_date, sale_date, state) 
                                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
                                            [id_enterprise, 'no-image.png', name, description, category, '', sku, stock_real, stock_real, 1, sale_price, sale_price, 1, '', 'activo'],
                                            (error, results) => {
                                                if (error) return reject(error);
                                                add++;
                                                resolve(results);
                                            }
                                        );
                                    });
                                }
                            }
                
                            // Confirmar la transacción
                            await new Promise((resolve, reject) => {
                                conect.commit(err => {
                                    if (err) return reject(err);
                                    resolve();
                                });
                            });
                
                            return { done: true, add: add, updated: updated };
                        } catch (error) {
                            // En caso de error, hacer rollback de la transacción
                            await new Promise((resolve, reject) => {
                                conect.rollback(() => {
                                    reject(error);
                                });
                            });
                            throw error; // Lanza el error para manejarlo en el bloque `catch` del controlador principal
                        }
                    }
                
                    // Obtener una conexión de la pool de conexiones
                    connection.con.getConnection(async (err, conect) => {
                        if (err) {
                            res.send({ status: 0, error: err });
                            return;
                        }
                
                        try {
                            // Llamar a la función importProducts para procesar los productos
                            const response = await importProducts(conect, id_enterprise, products);
                            res.send({ status: 1, data: response });
                        } catch (error) {
                            res.send({ status: 0, error: error.message });
                        } finally {
                            conect.release(); // Liberar la conexión para que vuelva a la pool
                        }
                    });
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
                                //error porque existe la categoría
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


        //Storages
            // Devuelve el número total de facturas por id para paginador
            router.post('/get-count-storages', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT COUNT(*) as total FROM storage WHERE id_enterprise = ?`;
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

            // Devuelve el listado de los depósitos
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

            // Devuelve un depósitos por ID
            router.post('/get-storage-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_storage} = req.body;
                    const sql = `SELECT * FROM storage WHERE id = ?`;
                    connection.con.query(sql, id_storage, (err, result, fields) => {
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

            // Devuelve datos específicos de la tabla storage
            router.post('/get-storage-data', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, id_storage} = req.body;
                    const sql = `SELECT * FROM ( 
                                SELECT CAST(COUNT(p.id) AS CHAR) as data FROM product as p WHERE p.stock_real > 0 AND p.storage_location = ? AND p.id_enterprise = ? 
                                UNION 
                                SELECT FORMAT(SUM(p.sale_price), 2) FROM product as p WHERE p.stock_real > 0 AND p.storage_location = ? AND p.id_enterprise = ? ) 
                                AS results`;
                    connection.con.query(sql, [id_storage, id_enterprise, id_storage, id_enterprise], (err, result, fields) => {
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


            //Editar campos de un storage
                //Crea un depósito nuevo
                router.post('/create-storage', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id_enterprise, name, phone, address, city, state, country} = req.body;
                        const sql_e = `SELECT name FROM storage WHERE name = ?;`
                        connection.con.query(sql_e, name, (err, result, fields) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                if (!result.length) {
                                    //éxito en no encontrar este depósito
                                    const sql = `INSERT INTO storage (id_enterprise, name, phone, address, city, state, country, status)
                                                VALUES (?,?,?,?,?,?,?, 1);`;
                                    connection.con.query(sql, [id_enterprise, name, phone, address, city, state, country], (err, response, fields) => {
                                        if (err) {
                                            //error de conexion o para crear el depósito
                                            res.send({status: 0, data: err});
                                        } else {
                                            res.send({status: 1, data: response})
                                        }
                                    })
                                } else{
                                    //error porque existe depósito
                                    res.send({status: 1, data: 'existente'});
                                }
                            }
                        });


                    } catch (error) {
                        res.send({status: 0, error: error});
                    }
                    connection.con.end;
                });

                // Edita un storage
                router.post('/edit-storage', auth.verifyToken, async function(req, res, next){
                    try{
                        let {id, name, phone, address, city, state, country} = req.body;
                        const sql = `UPDATE storage AS s
                                    SET name=?, phone=?, address=?, city=?, state=?, country=?
                                    WHERE s.id = ?`;
                        connection.con.query(sql, [name, phone, address, city, state, country, id], (err, result, fields) => {
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

                //Activa o desactiva un storage
                router.post('/edit-storage-activation', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, status} = req.body;

                        const sql = `UPDATE storage AS s 
                                    SET status=? WHERE s.id = ?`;
                        connection.con.query(sql, [status, id], (err, result, field) => {
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


        //Providers
            // Devuelve el número total de provedores por empresa para el paginador
            router.post('/get-count-providers', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT COUNT(*) as total FROM provider WHERE id_enterprise = ?`;
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

            // Devuelve un proveedor por ID
            router.post('/get-provider-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_provider} = req.body;
                    const sql = `SELECT * FROM provider WHERE id = ?`;
                    connection.con.query(sql, id_provider, (err, result, fields) => {
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

            //Crea un proveedor nuevo
            router.post('/create-provider', auth.verifyToken, async function(req, res, next){
                try {
                    let {id_enterprise, name, phone, whatsapp, email, address, country } = req.body;
                    const sql_e = `SELECT name FROM provider WHERE name = ?;`
                    connection.con.query(sql_e, name, (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            if (!result.length) {
                                //éxito en no encontrar este proveedor
                                const sql = `INSERT INTO provider (id_enterprise, name, phone, whatsapp, email, address, country, created)
                                            VALUES (?,?,?,?,?,?,?, NOW());`;
                                connection.con.query(sql, [id_enterprise, name, phone, whatsapp, email, address, country], (err, response, fields) => {
                                    if (err) {
                                        //error de conexion o para crear el proveedor
                                        res.send({status: 0, data: err});
                                    } else {
                                        res.send({status: 1, data: response})
                                    }
                                })
                            } else{
                                //error porque existe proveedor
                                res.send({status: 1, data: 'existente'});
                            }
                        }
                    });


                } catch (error) {
                    res.send({status: 0, error: error});
                }
                connection.con.end;
            });

            // Edita un proveedor
            router.post('/edit-provider', auth.verifyToken, async function(req, res, next){
                try{
                    let {id, name, phone, whatsapp, email, address, country} = req.body;
                    const sql = `UPDATE provider AS p
                                SET name=?, phone=?, whatsapp=?, email=?, address=?, country=?
                                WHERE p.id = ?`;
                    connection.con.query(sql, [name, phone, whatsapp, email, address, country, id], (err, result, fields) => {
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

            // Devuelve datos específicos de la tabla productos
            router.post('/get-provider-data', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, id_provider} = req.body;
                    const sql = `SELECT * FROM ( 
                                SELECT CAST(COUNT(p.id) AS CHAR) as data FROM product as p WHERE p.stock_real > 0 AND p.provider = ? AND p.id_enterprise = ? 
                                UNION 
                                SELECT FORMAT(SUM(p.purchase_price), 2) FROM product as p WHERE p.stock_real > 0 AND p.provider = ? AND p.id_enterprise = ? 
                                UNION 
                                SELECT MAX(STR_TO_DATE(purchase_date, '%Y-%m-%d')) FROM product AS p WHERE p.stock_real > 0 AND p.provider = ? AND p.id_enterprise = ?
                                ) AS results`;
                    connection.con.query(sql, [id_provider, id_enterprise, id_provider, id_enterprise, id_provider, id_enterprise], (err, result, fields) => {
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
                const sql = `SELECT u.id AS id_user, id_enterprise, u.email, u.thumbnail, u.state AS verified_state,
                            (SELECT e.id FROM employee AS e WHERE e.id_user = u.id) AS id_employee, 
                            (SELECT e.name FROM employee AS e WHERE e.id_user = u.id) AS name_employee, 
                            (SELECT r.name_role FROM employee AS e INNER JOIN role AS r ON e.role = r.id WHERE e.id_user = u.id) AS role,
                            (SELECT r.icon_role FROM employee AS e INNER JOIN role AS r ON e.role = r.id WHERE e.id_user = u.id) AS icon_role, 
                            (SELECT e.status FROM employee AS e WHERE e.id_user = u.id) AS state_employee 
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

        //Devuelve un listado de los roles
        router.post('/get-roles', auth.verifyToken, async function(req, res, next){
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

        //Actualiza el rol de un usuario
        router.post('/update-user-role', auth.verifyToken, async function(req, res, next){
            try {
                let {id, role} = req.body;
                const _sql = `UPDATE employee SET role=? WHERE id_user = ?`;
                connection.con.query(_sql, [role, id], (err, result, fields) => {
                    if (err) res.send({status: 0, data: err});
                    res.send({status: 1, data: result});
                });
            } catch (error) {
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

    // -----------------------------------

module.exports = router;