const Vehicle = {
    move() {
        console.log("Vehicle is moving");
    }
}

const Car = Object.create(Vehicle);
Car.honk = function() {
    console.log('Car is honking');
}

const ElectricCar = Object.create(Car);
ElectricCar.charge = function() {
    console.log('Electric Car is charging');
}

const newElectricCar = Object.create(ElectricCar);

newElectricCar.charge();
newElectricCar.honk();
newElectricCar.move();