
import Usuario from "../models/Usuario.js";
import Producto from "../models/Producto.js";
import Cliente from "../models/Cliente.js";
import Pedido from "../models/Pedido.js";
import bcryptjs from "bcryptjs"
import dotenv from "dotenv";
dotenv.config({path:".env"});
import jwt from "jsonwebtoken";
//resolvers: son siempre un objeto

const crearToken = (usuario, secreta, expiresIn)=>{
   
    const {id, email,nombre,apellido} = usuario;
    return jwt.sign({id, nombre, apellido,email}, secreta, {expiresIn})
}
const resolvers = {
    Query:{
        obtenerUsuario:async(_,{ }, ctx)=>{
            console.log('mi ct', ctx)
            return ctx.usuario
        },
        obtenerProductos:async ()=>{
            try {
                const productos = await Producto.find();
                return productos;
            } catch (error) {
                console.log(error)
            }
        },
        obtenerProducto:async(_,{id})=>{
            //revisar si el producto existe o no
            const producto = await Producto.findById(id);
           
            if(!producto){
                throw new Error('Producto no encontrado')
            }
            return producto
        },
        obtenerClientes :async ()=>{
            try {
                const clientes = await Cliente.find({});
                return clientes;
            } catch (error) {
                console.log(error)
            }
        },
        obtenerClientesVendedor: async(_,{},ctx)=>{
            try {
                const clientes = await Cliente.find({vendedor: ctx.usuario.id.toString()});
                return clientes;
            } catch (error) {
                console.log(error)
            }
        },
        obtenerCliente: async(_,{id}, ctx)=>{
            //revisar si el cliente existe o no
            const cliente = await Cliente.findById(id);
            if(!cliente){
                throw new Error('Cliente no encontrado');
            }
            //quien lo creo puede verlo
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes las credenciales');
            }
            return cliente
        },
        obtenerPedidos: async () => {
            try {
                const pedidos = await Pedido.find();
                return pedidos
            } catch (error) {
                console.log(error)
            }
        },
        obtenerPedidosVendedor: async (_, {}, ctx) => {
            try {
                const pedidos = await Pedido.find({vendedor: ctx.usuario.id}).populate('cliente');
                return pedidos
            } catch (error) {
                console.log(error)
            }
        },
        obtenerPedido: async(_,{id}, ctx)=>{
            //si el pedido existe o no
            const pedido = await Pedido.findById(id);
            if(!pedido){
                throw new Error ('Pedido no encontrado')
            }
            //solo quien lo creo
            if(pedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error ('Acción no permitida');
            }

            //retornar el rtesultado
            return pedido;
        },
        obtenerPedidosEstado: async (_, {estado}, ctx) =>{
            const pedidos = await Pedido.find({vendedor: ctx.usuario.id, estado});
            return pedidos;
        },
        mejoresClientes :async () => {
            //la funcion agrregate toma diferentes valores, hacer varias operaciones y retornar un solo resultado
            //para identificar cual es el mejor cliente buscamos el que tenag mayores pedidos 
            const clientes = await Pedido.aggregate([
                //va a ser buen cliente cuanya haya completado sus pedidos
                {$match : { estado:"COMPLETADO"}},
                {$group: {
                    //group agrupa del modelo clientes 'en minuscula' el campo total
                    _id:"$cliente",
                    total : {$sum: '$total'}
                }},
                {//lookup funciona como un join
                    $lookup:{
                        from:'clientes',
                        localField:'_id',
                        foreignField:"_id",
                        as:"cliente"
                    }
                },
                {
                    $sort: {total: -1}
                }
            ]);
            return clientes
        },
         mejoresVendedores: async()=>{
            const vendedores = await Pedido.aggregate([
                {
                    $match: {estado:"COMPLETADO"}
                },
                {
                    $group: {
                        _id:"$vendedor",
                        total: {$sum:'$total'}
                    }
                },
                {
                    $lookup:{
                        from:'usuarios',
                        localField:'_id',
                        foreignField:'_id',
                        as:'vendedor'
                    }
                },
                {
                    //con limit traeme solo los mejores cinco veendores
                    $limit: 5
                },
                {
                    $sort: {total:-1}
                }
            ]);

            return vendedores
         },
         buscarProducto: async(_,{texto}) => {
            const productos = await Producto.find({$text:{$search:texto}}).limit(10)
            return productos;
         }
    },
    Mutation:{
        nuevoUsuario:async(_,{input})=>{
            const {email, password} = input;
            //Revisar si ek usuario ya está registrado
            const existeUsuario = await Usuario.findOne({email});
            if(existeUsuario){
                throw new Error("El usuario ya está registrado")
            }
            //hashear password
            const salt =  await bcryptjs.genSalt(10);
            input.password =  await bcryptjs.hash(password, salt);
            //guardar en bd
            try {
                const usuario = new Usuario(input);
                usuario.save();
                return usuario;
            } catch (error) {
                console.log(error)
            }

        },
        autenticarUsuario: async(_,{input})=>{
            const {email, password} = input;
            //revisar si el usuario existe
            const existeUsuario = await Usuario.findOne({email});
            if(!existeUsuario){
                throw new Error('El usuario no existe');
            }
            //revisar si el password es correcto
            const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password);
            if(!passwordCorrecto){
                throw new Error('Password Incorrecto');
            }
            //crear el token
            return {
                token:crearToken(existeUsuario, process.env.SECRETA, '24h')
            }
            
        },
        nuevoProducto: async (_,{input})=>{
            try {
                const producto = new Producto(input);
                //alamcenar en la bd

                const resultado = await producto.save();
                return resultado
            } catch (error) {
                console.log(error)
            }
        },
        actualizarProducto:async(_,{id, input})=>{
            let producto = await Producto.findById(id);
           
            if(!producto){
                throw new Error('Producto no encontrado')
            }
           //guardarlo en la bd
           producto = await Producto.findOneAndUpdate({_id:id}, input, {new:true})
           return producto

        },
        eliminarProducto: async(_,{id})=>{
            let producto = await Producto.findById(id);
           
            if(!producto){
                throw new Error('Producto no encontrado')
            }

            //Eliminamos
            await Producto.findOneAndDelete({_id:id});
            return 'Producto eliminado correctamente'
        },
        nuevoCliente:async(_,{input},ctx)=>{
            //verificar si el cliente ya esta registrado
            const {email} = input;
            const cliente = await Cliente.findOne({email})
            if(cliente){
                throw new Error('El cliente ya está registrado');
            }
            //asignar el vendedor
            const nuevoCliente = new Cliente(input);
            
            //asignar el vendedor
            nuevoCliente.vendedor = ctx.usuario.id

            //guardar en la bd
            try {
                const resultado = await nuevoCliente.save();
                return resultado;
            } catch (error) {
                console.log(error)
            }
            
        },
        actualizarCliente: async(_,{id, input}, ctx)=>{
            //verificar si existe o no
            let cliente = await Cliente.findById(id);
            if(!cliente){
                throw new Error('El cliente no existe')
            }
            //verificar si el vendedor es quien edita
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes las credenciales');
            }

            //guiardar el cliente
            cliente = await Cliente.findOneAndUpdate({_id:id}, input, {new:true});
            return cliente;
        },
        eliminarCliente: async(_,{id}, ctx)=>{
            let cliente = await Cliente.findById(id);
            if(!cliente){
                throw new Error('El cliente no existe')
            }
            //verificar si el vendedor es quien elimina
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes las credenciales');
            }

            //Eliminar Cliente
            await Cliente.findOneAndDelete({_id:id});
            return "Cliente eliminado"
        },
        nuevoPedido: async(_ ,{input}, ctx)=>{
            const {cliente} = input;
            //verificar si el cliente existe o no
            let clienteExiste = await Cliente.findById(cliente)
            if(!clienteExiste){
                throw new Error('Este cliente no existe');
            }
            //verificar si el cliente es del vendedor
            
            if(clienteExiste.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes las credenciales');
            }

            //revisar qu el stock esté disponible
            for await (const articulo of input.pedido){
                const { id } = articulo;
                const producto = await Producto.findById(id);
                if(articulo.cantidad > producto.existencia){
                    throw new Error (` El articulo ${producto.nombre} excede la cantidad disponible`);
                }
                else{
                    //Restar la cantidad a lo disponible
                    producto.existencia = producto.existencia - articulo.cantidad;
                    await producto.save();
                }
            }

            //crear un nuevo pedido
            const nuevoPedido = new Pedido(input);

            //asignarle un vendedor
            nuevoPedido.vendedor = ctx.usuario.id;
            //guardarlo en la base de datos
            const resultado = await nuevoPedido.save();
            return resultado;
        },
        actualizarPedido: async (_,{id, input}, ctx)=>{
            const { cliente } = input
            // verificar si el pedido existe
            const existePedido = await Pedido.findById(id);
            if(!existePedido){
                throw new Error('El pedido no existe');
            }

            //si el cliente existe
            const existeCliente = await Cliente.findById(cliente);
            if(!existeCliente){
                throw new Error('El Cliente no existe');
            }
            //si el cliente y pedido pertenece al vendedor
            if(existeCliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes las credenciales');
            }

            //revisar el stock
            if(input.pedido){
                for await (const articulo of input.pedido){
                    const { id } = articulo;
                    const producto = await Producto.findById(id);
                    if(articulo.cantidad > producto.existencia){
                        throw new Error (` El articulo ${producto.nombre} excede la cantidad disponible`);
                    }
                    else{
                        //Restar la cantidad a lo disponible
                        producto.existencia = producto.existencia - articulo.cantidad;
                        await producto.save();
                    }
                }
            }
            

            //guardar el pedido
            const resultado = await Pedido.findOneAndUpdate({_id:id}, input, {new:true});
            return resultado
        },
        eliminarPedido : async (_, {id}, ctx)=>{
            //verificamos si el pedido existe o no
            const pedido = await Pedido.findById(id);
            if(!pedido){
                throw new Error('El pedido no existe');
            }

            //verificar si el vendeor es quien lo intenta borrar
            if(pedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tienes las credenciales');
            }
            //elimoinar de la bd;

            await Pedido.findOneAndDelete({_id:id})
            return 'Pedido eliminado'
        }

    }
}

export default resolvers