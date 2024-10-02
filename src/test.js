class Book {
    constructor(isbn, author, title) {
        this.isbn = isbn;
        this.author = author;
        this.title = title;
    }
}

class Library {
    constructor(name) {
        this.name = name;
        this.books = [];
    }

    addBook(book) {
        this.books.push(book);
    }

    removeBook(isbn) {
        this.books = this.books.filter(book => book.isbn !== isbn);
    }

    findBookByTitle(title) {
        return this.books.find(book => book.title === title);
    }
}

const book1 = new Book(1, 'Antony A', 'First book');
const book2 = new Book(2, 'Antony A', 'Second book');
const book3 = new Book(3, 'Joy B', 'First book');

const library = new Library('MAIN LIB');
library.addBook(book1);
library.addBook(book2);
library.addBook(book3);
library.removeBook(2)
console.log(library.findBookByTitle('First book'));
console.log(library);


