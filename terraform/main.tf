terraform {
  required_version = ">= 1.9, < 2.0"
  backend "azurerm" {}
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.50" }
  }
}
