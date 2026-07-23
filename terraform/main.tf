terraform {
  required_version = ">= 1.9, < 2.0"
  backend "azurerm" {}
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.50" }
  }
}
provider "azurerm" {
  features {}
  storage_use_azuread = true
}
data "azurerm_client_config" "current" {}
locals {
  tags = { service = "sentiment-analysis", environment = var.environment, managed_by = "terraform" }
}
