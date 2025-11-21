# Build stage
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime
FROM eclipse-temurin:21-jre-noble
WORKDIR /app

# Install ImageMagick and dependencies
RUN apt-get update && \
    apt-get install -y imagemagick libheif1 libde265-0 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV APP_IMAGEMAGICK_CMD=convert

COPY --from=build /app/target/blossombuds-api-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
