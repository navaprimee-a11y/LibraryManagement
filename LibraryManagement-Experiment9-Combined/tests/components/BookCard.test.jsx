import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BookCard from "../../src/components/BookCard";

const book = {
  id: 101,
  title: "The Hobbit",
  author: "J.R.R. Tolkien",
  category: "Fantasy",
  publishedYear: 1937,
  rating: 5,
  available: true,
};

function renderBookCard(bookData = book) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<BookCard book={bookData} />} />
        <Route
          path="/borrow-request/:id"
          element={<p>Borrow request page</p>}
        />
      </Routes>
    </MemoryRouter>,
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}>
      {/* Existing test routes */}
    </MemoryRouter>,
  );
}

describe("BookCard", () => {
  test("shows the book title, author, rating, and availability", () => {
    renderBookCard();
    expect(
      screen.getByRole("heading", { name: "The Hobbit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("J.R.R. Tolkien")).toBeInTheDocument();
    expect(screen.getByText("Rating:")).toBeInTheDocument();
    expect(screen.getByLabelText("Book status: Available")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Borrow this book: The Hobbit" }),
    ).toBeInTheDocument();
  });

  test("navigates to the borrowing form when Borrow is clicked", () => {
    renderBookCard();
    fireEvent.click(
      screen.getByRole("button", { name: "Borrow this book: The Hobbit" }),
    );
    expect(screen.getByText("Borrow request page")).toBeInTheDocument();
  });

  test("offers a hold request when the book is unavailable", () => {
    renderBookCard({ ...book, available: false });
    expect(
      screen.getByLabelText("Book status: Unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request a hold: The Hobbit" }),
    ).toBeInTheDocument();
  });
});
