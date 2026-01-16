describe("proMT – Tasks: Add Task modal", () => {
  const apiTasks = "/api/tasks*"; 
  const apiCreateTask = "/api/tasks/"; 

  it("validates and creates a new task", () => {
    cy.intercept("GET", apiTasks, {
      statusCode: 200,
      body: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, title: "Istniejące zadanie", status: "todo", priority: 2 },
        ],
      },
    }).as("getTasksInitial");

    cy.intercept("POST", apiCreateTask, (req) => {
      expect(req.body.title).to.eq("Nowe zadanie poprawne");
      req.reply({ statusCode: 201, body: { id: 2, ...req.body } });
    }).as("createTask");

    cy.intercept("GET", apiTasks, {
      statusCode: 200,
      body: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 1, title: "Istniejące zadanie", status: "todo", priority: 2 },
          { id: 2, title: "Nowe zadanie poprawne", status: "todo", priority: 2 },
        ],
      },
    }).as("getTasksAfterCreate");

    cy.visit("/dashboard/tasks"); 
    cy.wait("@getTasksInitial");

    cy.contains("Istniejące zadanie").should("be.visible");
    cy.contains("button", /Dodaj zadanie/i).click();

    const titleSelector = 'input[placeholder="Np. Przygotować ofertę"]';
    cy.get(titleSelector).as("title");
    cy.contains("button", /Zapisz/i).as("submit");

    cy.get("@submit").should("be.disabled");
    cy.get("@title").type("aa");
    cy.get("@submit").should("be.disabled");
    cy.contains(/Tytuł musi mieć min\. 3 znaki/i).should("be.visible");

    cy.get("@title").clear().type("Nowe zadanie poprawne");
    cy.get("@submit").should("not.be.disabled").click();

    cy.wait("@createTask");
    cy.wait("@getTasksAfterCreate");

    cy.contains("Nowe zadanie poprawne").should("be.visible");
  });
});