# Broken Java Spring Boot Project (Fixture)

This fixture represents a Spring Boot project with a missing database configuration:

1. **`SPRING_BOOT_DATASOURCE_MISSING`**: `pom.xml` declares `spring-boot-starter-data-jpa` and runtime driver `postgresql`, but lacks an embedded database (like H2) and `src/main/resources/application.properties` does not declare `spring.datasource.url`.

