class Game{
    constructor(map_data, canvas){
        this.canvas = canvas;
        this.bank = new Bank(19);
        this.board = new Board(map_data, this.bank);
        this.board.display(this.canvas);
        this.roll = null;
        this.dice = [new Die(6), new Die(6)];
        this.players = [];
        this.longest_road = null;
        this.largest_army = null;
        this.current_player_pointer = null;
    }

    add_player(player){
        this.players.push(player);
    }

    roll_dice(){
        this.roll = this.dice.map(die => die.roll()).reduce((a, b) => a + b, 0);
        return this.roll;
    }
}

class Die{
    constructor(faces){
        this.faces = faces;
    }
    roll(){
        return 1 + Math.floor(Math.random() * this.faces);
    }
}

class Hand{
    constructor(){
        this.resources = {}
        this.resources["wood"] = 0;
        this.resources["brick"] = 0;
        this.resources["sheep"] = 0;
        this.resources["wheat"] = 0;
        this.resources["brick"] = 0;
        this.developments = []
    }
    count_resource(resource){
        return this.resources[resource];
    }
    add_resource(resource, count){
        this.resources[resource] += count;
    }
    remove_resource(resource, count){
        this.resources[resource] -= count;
    }
}

class Bank extends Hand{
    constructor(resource_count){
        super();
        this.resources["wood"] = resource_count;
        this.resources["brick"] = resource_count;
        this.resources["sheep"] = resource_count;
        this.resources["wheat"] = resource_count;
        this.resources["brick"] = resource_count;
        for(let i = 0; i < 14; i++){
            this.developments.push(new Knight());
            if(i < 5){
                this.developments.push(new VictoryPointCard());
                if(i < 2){
                    this.developments.push(new RoadBuilding());
                    this.developments.push(new YearOfPlenty());
                    this.developments.push(new Monopoly());
                }
            }
        }
        shuffle(this.developments);
        this.trade_ratio = 4;
    }
    give_resource(resource, quantity, recipient){
        if(this.count_resource(resource) >= quantity){
            recipient.add_resource(resource, quantity);
            this.remove_resource(resource, quantity);
            return true;
        }
        return false;
    }
    take_resource(resource, quantity, hand){
        if(hand.count_resource(resource) >= quantity){
            hand.remove_resource(resource, quantity);
            this.add_resource(resource, quantity);
            return true;
        }
        return false;
    }
    trade_resource(incoming, outgoing, hand){
        if(this.count_resource(outgoing) >= 1){
            if(this.take_resource(incoming, this.trade_ratio, hand)){
                this.give_resource(outgoing, 1, hand);
                return true;
            }
        }
        return false;
    }
}

class Development_Card{}
class Knight extends Development_Card{}
class RoadBuilding extends Development_Card{}
class YearOfPlenty extends Development_Card{}
class Monopoly extends Development_Card{}
class VictoryPointCard extends Development_Card{}



class Player{
    constructor(name, colour){
        this.name = name;
        this.colour = colour;
        this.points = 0;
        this.visible_points = 0;
        this.hand = new Hand();
    }
}

class Board{
    constructor(map_data, bank){
        this.map_data = map_data;
        // get layouts
        let hexes = this.map_data["hex-layout"];
        this.hexes = hexes[0].map((_, colIndex) => hexes.map(row => row[colIndex]));
        let numbers = this.map_data["number-layout"];
        numbers = numbers[0].map((_, colIndex) => numbers.map(row => row[colIndex]));
        let ports = this.map_data["port-layout"];
        ports = ports[0].map((_, colIndex) => ports.map(row => row[colIndex]));
        // get available parts for randomisation
        let available_hexes = this.map_data["unassigned-hexes"];
        let available_numbers = this.map_data["unassigned-numbers"];
        let available_ports = this.map_data["unassigned-ports"];
        shuffle(available_hexes)
        shuffle(available_numbers)
        shuffle(available_ports)
        for(let x = 0; x < this.hexes.length; x++){
            for(let y = 0; y < this.hexes[0].length; y++){
                if((x+y) % 2 !== 0){continue;}
                let hex_type = this.hexes[x][y]
                if(hex_type === "r"){
                    hex_type = available_hexes.pop()
                }
                let number = numbers[x][y];
                if(number === "r"){
                    number = available_numbers.pop();
                }
                number = parseInt(number);
                let robber_placed = false;
                switch(hex_type){
                    case null:
                        continue;
                    case "d":
                        this.hexes[x][y] = new DesertHex();
                        if(!robber_placed){
                            this.hexes[x][y].robbed = true;
                            robber_placed = true;
                        }
                        break;
                    case "s":
                        this.hexes[x][y] = new SeaHex();
                        break;
                    case "wood":
                    case "brick":
                    case "sheep":
                    case "wheat":
                    case "ore":
                        this.hexes[x][y] = new ResourceHex(hex_type, number);
                }
            }
        }
        for(let x = 0; x < this.hexes.length; x++) {
            for (let y = 0; y < this.hexes[0].length; y++) {
                let port = ports[x][y];
                if(!port){continue}
                for(let i = 0; i < port.length; i++){
                    if(port[i][1] === "r"){
                        port[i][1] = available_ports.pop();
                    }
                    let new_port = new Port(port[i][1], bank)
                    this.hexes[x][y].add_port(port[i][0], new_port);
                    this.hexes[x][y].add_port((1+port[i][0])%6,new_port);
                    let adjacent = [...this.get_vertex_neighbour_coords(x, y, port[i][0]), ...this.get_vertex_neighbour_coords(x, y, (1+port[i][0])%6)];
                    for(let index = 0; index < adjacent.length; index++){
                        if(adjacent[index][0] < 0 || adjacent[index][1] < 0 || adjacent[index][0] >= this.hexes.length || adjacent[index][1] >= this.hexes[0].length){
                            continue;
                        }
                        let adjacent_x = adjacent[index][0];
                        let adjacent_y = adjacent[index][1];
                        if(this.hexes[adjacent_x][adjacent_y] instanceof LandHex){
                            this.hexes[adjacent_x][adjacent_y].add_port(adjacent[index][2], new_port);
                        }
                    }
                }
            }
        }

    }
    draw_hexagon(x, y, r, hex, canvas){
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = hex.colour;
        ctx.strokeStyle = "#000000";
        let a = 2*Math.PI/6;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            ctx.lineTo(x + r * Math.sin(a * i), y + r * Math.cos(a * i));
        }
        ctx.closePath();
        if(hex instanceof LandHex){
            ctx.fill();
        }
        ctx.stroke();
        if(hex.robbed){
            ctx.fillStyle = "#5b5755";
            ctx.beginPath();
            ctx.arc(x+r/4, y+r/4, r/4, 0, 2*Math.PI, false);
            ctx.closePath();
            ctx.fill();
            ctx.stroke()
        }
        if(hex.number){
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(x, y, r/4, 0, 2 * Math.PI, true);
            ctx.closePath();
            ctx.fill();
            ctx.stroke()
            ctx.font = "bold 30px garamond-mt";
            ctx.fillStyle = "#000000";
            if(hex.number === 6 || hex.number === 8){
                ctx.fillStyle = "#ff0000";
            }
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(hex.number.toString(), x, y);
        }

    }

    draw_ports(x, y, r, hex, canvas){
        let ctx = canvas.getContext("2d");
        let vertices = hex.vertices;
        let a = 2*Math.PI/6;
        for(let i = 0; i < vertices.length; i++){
            for(let j = 0; j < vertices[i].length; j++){
                if(vertices[i][j] instanceof Port){
                    if(vertices[(i+1)%6].includes(vertices[i][j])){
                        let point_a = [x + r * Math.sin(a * i), y - r * Math.cos(a * i)];
                        let point_b = [x + r * Math.sin(a * (i+1)), y - r * Math.cos(a * (i+1))];
                        let midpoint = [(point_a[0] + point_b[0])/2, (point_a[1] + point_b[1])/2];
                        let angle_to_point_a = Math.atan2(midpoint[1] - point_a[1], midpoint[0] - point_a[0]);
                        let radius = Math.sqrt((Math.pow(point_a[0]-point_b[0],2))+(Math.pow(point_a[1]-point_b[1],2)))/2;
                        ctx.strokeStyle = "#349587";
                        ctx.fillStyle = "#349587";
                        ctx.beginPath();
                        ctx.arc(midpoint[0], midpoint[1], radius, angle_to_point_a, angle_to_point_a+Math.PI, true);
                        ctx.closePath();
                        ctx.stroke();
                        ctx.fill();
                        let angle_to_midpoint = Math.atan2(midpoint[1] - y, midpoint[0] - x);
                        let new_point = [midpoint[0] + Math.cos(angle_to_midpoint)*(radius/2), midpoint[1] + Math.sin(angle_to_midpoint)*(radius/2)]
                        ctx.font = "bold 10px garamond-mt";
                        ctx.fillStyle = "#000000";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        let text = "3:1"
                        console.log(vertices[i][j].type)
                        switch(vertices[i][j].type){
                            case "wood":
                                text = "2🪵:1";
                                break;
                            case "brick":
                                text = "2🧱:1";
                                break;
                            case "sheep":
                                text = "2🐑:1";
                                break;
                            case "wheat":
                                text = "2🌾:1";
                                break;
                            case "ore":
                                text = "2🪨:1";
                        }
                        ctx.fillText(text, ...new_point);
                    }

                }
            }
        }
    }
    get_edge_neighbour_coords(x, y, edge){
        switch(edge){
            case 0:
                return [x+1, y-1, 3];
            case 1:
                return [x+2, y, 4];
            case 2:
                return [x+1, y+1, 5];
            case 3:
                return [x-1, y+1, 0];
            case 4:
                return [x-2, y, 1];
            case 5:
                return [x-1, y-1, 2];
        }
    }

    get_vertex_neighbour_coords(x, y, vertex){
        let first = this.get_edge_neighbour_coords(x, y, vertex)
        first[2] = (first[2]+1)%6;
        let second = this.get_edge_neighbour_coords(x, y, (vertex+5)%6);
        return [first, second];
    }

    display(canvas){
        let short_dimension = Math.min(canvas.width, canvas.height);
        let hex_radius = short_dimension/(2*Math.ceil(this.hexes.length/2));
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "#1552a3";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.stroke();
        for(let x = 0; x < this.hexes.length; x++){
            for(let y = 0; y < this.hexes[x].length; y++){
                if(this.hexes[x][y]){
                    let draw_x = (Math.sqrt(3)/2)*hex_radius*(x+1);
                    let draw_y = (3/2)*hex_radius*(y+1);
                    this.draw_hexagon(draw_x, draw_y, hex_radius, this.hexes[x][y], canvas);
                    this.draw_ports(draw_x, draw_y, hex_radius, this.hexes[x][y], canvas);

                }
            }
        }
    }

}

class Hex{
    constructor(producing=false){
        this.vertices = [[],[],[],[],[],[]];
        this.edges = [null, null, null, null, null, null];
        this.colour = "#1552a3"
        this.producing = producing;
        this.robbed = false;
    }
    add_road(road, edge){
        this.edges[edge] = road;
    }
    add_building(building, vertex){
        this.vertices[vertex].push(building);
    }
    add_port(){
        return false;
    }
}
class SeaHex extends Hex{}
class LandHex extends Hex{
    add_port(vertex, port){
        this.vertices[vertex].push(port);
    }
}
class DesertHex extends LandHex{
    constructor(producing=false) {
        super();
        this.colour = "#FFAE00";
    }
}

class ResourceHex extends LandHex{
    constructor(resource, number, producing=true) {
        super();
        this.producing = producing;
        this.resource = resource;
        this.number = number;
        this.colour = "blue";
        switch (this.resource){
            case "wood":
                this.colour = "#47873E";
                break;
            case "brick":
                this.colour = "#F50D0A";
                break;
            case "sheep":
                this.colour = "#35F50A";
                break;
            case "wheat":
                this.colour = "#F5E10A";
                break;
            case "ore":
                this.colour = "#757575";
        }
    }
    produce(roll){
        if(roll === this.number && this.producing){
            return true;
        }
    }
}

class Port{
    constructor(type, bank) {
        this.type = type;
        this.bank = bank;
        this.trade_ratio = 2;
        if(type === 3){
            this.trade_ratio = 3;
        }
    }
    trade_resource(incoming, outgoing, hand){
        if(this.type !== 3 && incoming !== this.type){
            return false;
        }
        if(this.bank.count_resource(outgoing) >= 1){
            if(this.bank.take_resource(incoming, this.trade_ratio, hand)){
                this.bank.give_resource(outgoing, 1, hand);
                return true;
            }
        }
    }
}

class Construction{
    constructor(player){
        this.player = player;
    }
}

class Road extends Construction{
    constructor(player, x, y, edge) {
        super();
        this.coordinates = [x, y, edge];
    }
}

class Settlement extends Construction{
    constructor(player, x, y, vertex) {
        super();
        this.coordinates = [x, y, vertex];
        this.point_value = 1;
        this.production = 1;
    }
}

class City extends Construction{
    constructor(player, settlement) {
        super();
        this.point_value = 2;
        this.production = 2;
        this.coordinates = settlement.coordinates;
    }
}


function shuffle(array) {
    let index = array.length;
    while (index !== 0) {
        let randomIndex = Math.floor(Math.random() * index);
        index--;
        [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
    }
}

async function get_map_data(path_to_map){
    return await fetch(path_to_map)
        .then(response => {return response.json();})
        .catch(error => {console.log(error); return false;});
}



async function setup(){
    let map_data = await get_map_data("/boards/islands.json");
    let canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = "absolute";
    document.body.appendChild(canvas);
    let game = new Game(map_data, canvas);
}