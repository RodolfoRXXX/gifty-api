//Función que genera un nuevo número de presupuesto/remito/factura

function generateNextNumber(lastRemito) {
    const nro = (lastRemito != '') ? lastRemito : '001-00000000';
    const [left, right] = nro.split('-').map(Number);
    let newRight = right + 1;
    let newLeft = left;

    if (newRight > 99999999) {
        newRight = 1;
        newLeft += 1;
    }

    return `${newLeft.toString().padStart(3, '0')}-${newRight.toString().padStart(8, '0')}`;
}

module.exports = generateNextNumber;