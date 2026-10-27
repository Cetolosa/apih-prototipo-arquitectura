// Registro de enlaces entre módulos: nombres definidos en módulos posteriores (o escritos desde otro módulo).
// Cada módulo dueño publica aquí un accesor get/set de su binding; así no hay ciclos de importación y el orden de carga es el del archivo.
export const ENLACES = {};
